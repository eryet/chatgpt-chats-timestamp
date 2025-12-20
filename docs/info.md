
# Info 

## Props

### Sidebar : children of Link component

```json
{
  "id": "",
  "title": "",
  "create_time": "2025-12-11T23:53:52.397582Z",
  "update_time": "2025-12-11T23:54:45.683849Z",
  "pinned_time": null,
  "mapping": null,
  "current_node": null,
  "conversation_template_id": null,
  "gizmo_id": null,
  "is_archived": false,
  "is_starred": null,
  "is_do_not_remember": false,
  "memory_scope": "global_enabled",
  "context_scopes": null,
  "context_scopes_v2": {
    "context_scopes": [
      {
        "is_siloed": false,
        "scope_namespace": "global",
        "sub_scope": null
      }
    ]
  },
  "workspace_id": null,
  "async_status": null,
  "safe_urls": [],
  "blocked_urls": [],
  "conversation_origin": null,
  "snippet": null,
  "sugar_item_id": null,
  "sugar_item_visible": false
}
```

### chat（key:text-message-key）

```json
{
  "className": null,
  "message": {
    "id": null,
    "author": null,
    "create_time": 1763464858.260357,
    "update_time": 1763464864.601976,
    "content": null,
    "status": null,
    "end_turn": true,
    "weight": 1,
    "metadata": {
      "finish_details": {
        "type": null,
        "stop_tokens": null
      },
      "is_complete": true,
      "sonic_classification_result": {
        "latency_ms": 0.3175020101480186,
        "simple_search_prob": 0.28600987952416607,
        "complex_search_prob": 0.0031268603592872484,
        "no_search_prob": 0.7108632601165467,
        "search_complexity_decision": null,
        "search_decision": false,
        "simple_search_threshold": 0,
        "complex_search_threshold": 0.4,
        "no_search_threshold": 0.12,
        "threshold_order": null,
        "classifier_config_name": null,
        "classifier_config": null,
        "decision_source": null,
        "passthrough_tool_names": null
      },
      "content_references": [],
      "citations": [],
      "request_id": null,
      "message_type": null,
      "model_slug": null,
      "default_model_slug": null,
      "parent_id": null,
      "turn_exchange_id": null,
      "timestamp_": null,
      "model_switcher_deny": []
    },
    "recipient": null,
    "channel": null,
    "clientMetadata": null
  },
  "isFeedbackEnabled": true,
  "isFinalUserTurn": false,
  "isWithinFirstAssistantTurns": true,
  "isCompletionInProgress": false,
  "hasActiveRequest": false,
  "turnIndex": 2,
  "conversation": {
    "ctx": null,
    "id": null,
    "serverId$": null
  },
  "isUserTurn": false,
  "prevGroupedMessageType": 15,
  "prevGroupedMessages": [
    {
      "id": null,
      "author": {
        "role": null,
        "name": null,
        "metadata": null
      },
      "create_time": 1763464858.7070181,
      "update_time": null,
      "content": {
        "content_type": null,
        "model_set_context": null,
        "repository": null,
        "repo_summary": null,
        "structured_context": null
      },
      "status": null,
      "end_turn": null,
      "weight": 1,
      "metadata": {
        "request_id": null,
        "message_type": null,
        "model_slug": null,
        "default_model_slug": null,
        "parent_id": null,
        "turn_exchange_id": null,
        "timestamp_": null,
        "model_switcher_deny": null
      },
      "recipient": null,
      "channel": null,
      "clientMetadata": null
    }
  ],
  "citableMessages": [],
  "superWidgetContent": null
}

```