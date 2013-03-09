// Copyright 2012 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Controllers for the interactive widget preview in the GuiEditor.
 *
 * @author sll@google.com (Sean Lip)
 */

function InteractiveWidgetPreview($scope, $http, $compile, warningsData, explorationData) {
  var data = explorationData.getStateData($scope.stateId);

  // Tests whether an object is a JavaScript array.
  $scope.isArray = function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  $scope.generateWidgetPreview = function(widgetId, widgetParams) {
    var request = $.param({
      params: JSON.stringify(widgetParams),
      state_params: JSON.stringify($scope.paramChanges)
    }, true);
    $http.post(
        '/interactive_widgets/' + widgetId,
        request,
        {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
    ).success(function(widgetData) {
        $scope.addContentToIframe('interactiveWidgetPreview', widgetData.widget.raw);
        $scope.interactiveWidget = widgetData.widget;
        $scope.interactiveParams = widgetParams;
      }
    );
  };

  $scope.initInteractiveWidget = function(data) {
    // Stores rules in the form of key-value pairs. For each pair, the key is
    // the corresponding action and the value has several keys:
    // - 'rule' (the raw rule string)
    // - 'inputs' (a list of parameters)
    // - 'attrs' (stuff needed to build the Python classifier code)
    // - 'dest' (the destination for this rule)
    // - 'feedback' (any feedback given for this rule)
    // - 'paramChanges' (parameter changes associated with this rule)
    $scope.interactiveRulesets = data.widget.rules;
    $scope.interactiveParams = data.widget.params;
    $scope.generateWidgetPreview(data.widget.id, data.widget.params);
  };

  if (data) {
    $scope.initInteractiveWidget(data);
  }

  $scope.getStateName = function(stateId) {
    return (stateId === END_DEST ? END_DEST : $scope.states[stateId].name);
  };

  $scope.getAllStates = function() {
    var allStates = [];
    for (var state in $scope.states) {
      allStates.push(state);
    }
    allStates.push(END_DEST);
    return allStates;
  };

  $scope.getDestName = function(stateId) {
    return stateId === '?' ? 'Add New State...' : $scope.getStateName(stateId);
  };

  // Returns a list of all states, as well as an 'Add New State' option.
  $scope.getAllDests = function() {
    var result = $scope.getAllStates();
    result.push('?');
    return result;
  };

  $scope.getExtendedChoiceArray = function(choices) {
    var result = [];
    for (var i = 0; i < choices.length; i++) {
      result.push({id: i, val: choices[i]});
    }
    return result;
  };

  $scope.selectRule = function(rule, attrs) {
    $scope.deselectAllRules();
    $scope.addRuleActionRule = rule;
    $scope.addRuleActionAttrs = attrs;
    $scope.addRuleActionDest = explorationData.stateId;
    $scope.addRuleActionDestNew = '';
  };

  $scope.deselectAllRules = function() {
    $scope.addRuleActionIndex = null;
    $scope.addRuleActionRule = null;
    $scope.addRuleActionAttrs = null;
    $scope.addRuleActionInputs = {};
    $scope.addRuleActionDest = null;
    $scope.addRuleActionDestNew = '';
    $scope.addRuleActionFeedback = null;
    $scope.addRuleActionParamChanges = null;
  };

  $scope.openAddRuleModal = function(action) {
    $scope.addRuleModalTitle = 'Add Rule';
    $scope.addRuleAction = action;
    $scope.addRuleActionIndex = null;
  };

  $scope.openEditRuleModal = function(action, index) {
    $scope.addRuleModalTitle = 'Edit Rule';
    $scope.addRuleAction = action;

    $scope.addRuleActionIndex = index;
    var rule = $scope.interactiveRulesets[action][index];
    $scope.addRuleActionRule = rule.rule;
    $scope.addRuleActionAttrs = rule.attrs;
    $scope.addRuleActionInputs = rule.inputs;
    $scope.addRuleActionDest = rule.dest;
    $scope.addRuleActionDestNew = '';
    $scope.addRuleActionFeedback = rule.feedback;
    $scope.addRuleActionParamChanges = rule.paramChanges;
  };

  $scope.saveRuleset = function(action, ruleset) {
    if (!$scope.interactiveRulesets.hasOwnProperty(action)) {
      $scope.interactiveRulesets[action] = [];
    }

    var rules = $scope.interactiveRulesets[action];
    if ($scope.addRuleActionIndex !== null) {
      rules[$scope.addRuleActionIndex] = ruleset;
    } else {
      rules.splice(rules.length - 1, 0, ruleset);
    }

    $('#addRuleModal').modal('hide');

    $scope.saveInteractiveWidget();
  };

  $scope.saveRulesetWithNewDest = function(action, ruleset, dest) {
    ruleset['dest'] = dest.id;
    $scope.saveRuleset(action, ruleset);
  };

  $scope.saveRule = function(rule, attrs, inputs, dest, newDest, feedback) {
    if (rule) {
      var ruleset = {
        rule: rule,
        attrs: attrs,
        inputs: inputs,
        dest: dest,
        feedback: feedback
      };

      // TODO(sll): Do more error-checking here.
      if (dest === '?') {
        // The user has added a new state.
        if (!newDest) {
          warningsData.addWarning('Error: destination state is empty.')
        } else if ($scope.convertDestToId(newDest, true)) {
          // The new state already exists.
          ruleset.dest = $scope.convertDestToId(newDest);
        } else {
          ruleset.dest = newDest;
          $scope.addState(
              $scope.addRuleActionDestNew,
              $scope.saveRulesetWithNewDest.bind(null, $scope.addRuleAction, ruleset));
          return;
        }
      }

      $scope.saveRuleset($scope.addRuleAction, ruleset);
    }

    $scope.addRuleAction = null;
    $scope.deselectAllRules();
  };

  $scope.swapRules = function(action, index1, index2) {
    $scope.tmpRule = $scope.interactiveRulesets[action][index1];
    $scope.interactiveRulesets[action][index1] =
        $scope.interactiveRulesets[action][index2];
    $scope.interactiveRulesets[action][index2] = $scope.tmpRule;

    $scope.saveInteractiveWidget();
  };

  $scope.deleteRule = function(action, index) {
    $scope.interactiveRulesets[action].splice(index, 1);
    $scope.saveInteractiveWidget();
  };

  $scope.convertDestToId = function(destName, hideWarnings) {
    if (!destName) {
      warningsData.addWarning('Please choose a destination.');
      return;
    }

    var destId = '';

    var found = false;
    if (destName.toUpperCase() == END_DEST) {
      found = true;
      destId = END_DEST;
    } else {
      // Find the id in states.
      for (var id in $scope.states) {
        if ($scope.states[id].name == destName) {
          found = true;
          destId = id;
          break;
        }
      }
    }

    if (!found) {
      warningsData.addWarning('Invalid destination name: ' + destName);
      return;
    }

    return destId;
  };

  $('#interactiveWidgetModal').on('hide', function() {
    // Reload the iframe.
    var F = $('#interactiveWidgetRepository');
    F[0].src = F[0].src;
  });

  $scope.saveWidgetParams = function() {
    $scope.generateWidgetPreview(
        $scope.interactiveWidget.id, $scope.interactiveParams);
    $scope.saveInteractiveWidget();
  };

  // Receive messages from the widget repository.
  $scope.$on('message', function(event, arg) {
    $scope.addContentToIframe('interactiveWidgetPreview', arg.data.raw);
    $('#interactiveWidgetModal').modal('hide');
    if ($scope.interactiveWidget.id != arg.data.widget.id) {
      $scope.interactiveWidget = arg.data.widget;
      $scope.interactiveParams = $scope.interactiveWidget.params;
      $scope.interactiveRulesets = {'submit': [{
        'rule': 'Default',
        'attrs': {},
        'inputs': {},
        'dest': $scope.stateId,
        'feedback': '',
        'paramChanges': []
      }]};
    }
    $scope.saveInteractiveWidget();
  });

  $scope.saveInteractiveWidget = function() {
    explorationData.saveStateData($scope.stateId, {
        // The backend actually just saves the id of the widget.
        'interactive_widget': $scope.interactiveWidget.id,
        'interactive_params': $scope.interactiveParams,
        'interactive_rulesets': $scope.interactiveRulesets
    });
  };
}

InteractiveWidgetPreview.$inject = ['$scope', '$http', '$compile', 'warningsData', 'explorationData'];
