
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
      "content_references": [
        {
          "matched_text": "",
          "start_idx": 319,
          "end_idx": 365,
          "safe_urls": [""],
          "refs": [],
          "alt": "",
          "prompt_text": null,
          "type": "grouped_webpages",
          "items": [""],
          "fallback_items": null,
          "status": "done",
          "error": null,
          "style": null
        },
      ],
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

### project-pills (project folder)

```html
<a tabindex="0" data-fill="" class="group __menu-item hoverable" data-sidebar-item="true" href="/g/g-p-690dd49d9a748191bcc982ad699ff4d7-react-study/project" data-discover="true"><div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center group-disabled:opacity-50 group-data-disabled:opacity-50 icon"><button class="icon" data-state="closed"><div class="[&amp;_path]:stroke-current text-token-text-primary" style="width: 20px; height: 20px;"><div><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 20 20" width="20" height="20" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; transform: translate3d(0px, 0px, 0px); content-visibility: visible;"><defs><clipPath id="__lottie_element_18"><rect width="20" height="20" x="0" y="0"></rect></clipPath></defs><g clip-path="url(#__lottie_element_18)"><g transform="matrix(1,0,0,1,0,0)" opacity="1" style="display: block;"><g opacity="1" transform="matrix(1.0285816192626953,-0.006075212266296148,0.13446564972400665,0.9714184403419495,0.7259734272956848,3.885779857635498)"><path stroke-linecap="round" stroke-linejoin="miter" fill-opacity="0" stroke-miterlimit="4" stroke="rgb(0,0,0)" stroke-opacity="1" stroke-width="1.33" d=" M14.5,5.644999980926514 C14.5,5.572000026702881 14.5,5.498000144958496 14.5,5.425000190734863 C14.5,4.094880104064941 14.5,3.429810047149658 14.241100311279297,2.9217700958251953 C14.013400077819824,2.4748899936676025 13.650099754333496,2.111560106277466 13.203200340270996,1.8838599920272827 C12.695199966430664,1.625 12.030099868774414,1.625 10.699999809265137,1.625 C9.931366920471191,1.625 9.16273307800293,1.625 8.394100189208984,1.625 C8.242400169372559,1.625 8.166600227355957,1.625 8.093500137329102,1.6204999685287476 C7.561999797821045,1.5877100229263306 7.056839942932129,1.377210021018982 6.6593098640441895,1.0228099822998047 C6.604680061340332,0.974120020866394 6.551270008087158,0.9202499985694885 6.444439888000488,0.8125 C6.444439888000488,0.8125 6.444439888000488,0.8125 6.444439888000488,0.8125 C6.337619781494141,0.7047500014305115 6.284210205078125,0.650879979133606 6.229579925537109,0.6021900177001953 C5.83204984664917,0.24778999388217926 5.326930046081543,0.037289999425411224 4.795370101928711,0.0044999998062849045 C4.722330093383789,0 4.646470069885254,0 4.494740009307861,0 C4.263160228729248,0 4.031579971313477,0 3.799999952316284,0 C2.4698801040649414,0 1.8048100471496582,0 1.2967699766159058,0.2588599920272827 C0.8498899936676025,0.48655998706817627 0.48655998706817627,0.8498899936676025 0.2588599920272827,1.2967699766159058 C0,1.8048100471496582 0,2.469870090484619 0,3.799999952316284 C0,5.599999904632568 0,7.400000095367432 0,9.199999809265137 C0,10.530099868774414 0,11.195199966430664 0.2588599920272827,11.703200340270996 C0.48655998706817627,12.150099754333496 0.8498899936676025,12.513400077819824 1.2967699766159058,12.741100311279297 C1.8048100471496582,13 2.4698801040649414,13 3.799999952316284,13 C4.616666793823242,13 5.433333396911621,13 6.25,13"></path></g></g><g transform="matrix(1,0,0,1,0,0)" opacity="1" style="display: block;"><g opacity="1" transform="matrix(1,0,-0.3057306706905365,1,4.790250301361084,9.694989204406738)"><path stroke-linecap="round" stroke-linejoin="miter" fill-opacity="0" stroke-miterlimit="4" stroke="rgb(0,0,0)" stroke-opacity="1" stroke-width="1.33" d=" M0.5920000076293945,0 C0.38477998971939087,0 0.2811700105667114,0 0.20202000439167023,0.03518543392419815 C0.1324000060558319,0.06613081693649292 0.07580000162124634,0.11551953852176666 0.04033000022172928,0.17625868320465088 C0,0.2453034520149231 0,0.3356967568397522 0,0.5164834260940552 C0,1.5075702667236328 0,2.4986572265625 0,3.489743947982788 C0,4.650174140930176 0,5.230432510375977 0.2588599920272827,5.673631191253662 C0.48655998706817627,6.063523769378662 0.8498899936676025,6.380568027496338 1.2967699766159058,6.579222202301025 C1.8048100471496582,6.805009365081787 2.4698801040649414,6.805009365081787 3.799999952316284,6.805009365081787 C6.099999904632568,6.805009365081787 8.399999618530273,6.805009365081787 10.699999809265137,6.805009365081787 C12.030099868774414,6.805009365081787 12.695199966430664,6.805009365081787 13.203200340270996,6.579222202301025 C13.650099754333496,6.380568027496338 14.013400077819824,6.063523769378662 14.241100311279297,5.673631191253662 C14.5,5.230432510375977 14.5,4.650174140930176 14.5,3.489743947982788 C14.5,2.4986572265625 14.5,1.5075702667236328 14.5,0.5164834260940552 C14.5,0.3356967568397522 14.5,0.2453034520149231 14.459699630737305,0.17625868320465088 C14.424200057983398,0.11551953852176666 14.367600440979004,0.06613081693649292 14.29800033569336,0.03518543392419815 C14.218799591064453,0 14.11520004272461,0 13.907999992370605,0 C9.46933364868164,0 5.030666828155518,0 0.5920000076293945,0 C0.5920000076293945,0 0.5920000076293945,0 0.5920000076293945,0 C0.5920000076293945,0 0.5920000076293945,0 0.5920000076293945,0z"></path></g></g></g></svg></div></div></button></div><div class="flex min-w-0 grow items-center gap-2.5"><div class="truncate">React Study</div></div></div><div class="trailing highlight text-token-text-tertiary"><button tabindex="0" data-trailing-button="" class="__menu-item-trailing-btn" type="button" id="radix-_r_ef_" aria-haspopup="menu" aria-expanded="false" data-state="closed"><div><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="/cdn/assets/sprites-core-mr1omm3f.svg#f6d0e2" fill="currentColor"></use></svg></div></button></div></a>
```

```json
{
  "gizmo": {
    "gizmo": {
      "id": "",
      "organization_id": "",
      "short_url": "",
      "author": {
        "user_id": "",
        "user_email": "",
        "display_name": "",
        "link_to": null,
        "is_verified": true,
        "selected_display": "name",
        "will_receive_support_emails": null,
        "display_socials": "[]"
      },
      "voice": {
        "id": "ember"
      },
      "workspace_id": null,
      "model": null,
      "default_model": null,
      "instructions": "",
      "display": {
        "name": "",
        "description": "",
        "prompt_starters": "[]",
        "profile_pic_id": null,
        "profile_picture_url": null,
        "categories": "[]",
        "emoji": null,
        "theme": null
      },
      "share_recipient": "",
      "created_at": "2025-11-07T11:14:37.603418+00:00",
      "updated_at": "2025-11-07T11:14:40.115110+00:00",
      "last_interacted_at": "2025-11-07T11:52:25.002897+00:00",
      "num_interactions": 10,
      "tags": [
        "private"
      ],
      "is_unassigned": false,
      "version": 1,
      "version_author": null,
      "version_created_at": "2025-11-07T11:14:38.254514+00:00",
      "version_updated_at": "2025-11-07T11:14:39.928395+00:00",
      "live_version": 1,
      "training_disabled": false,
      "sharing_targets": [
        "{allowed: true, moderated_fields: null, recipient: …}",
        "{allowed: true, moderated_fields: null, recipient: …}"
      ],
      "appeal_info": null,
      "vanity_metrics": {
        "num_conversations": null,
        "num_conversations_str": null,
        "created_ago_str": null,
        "review_stats": null
      },
      "workspace_approval_date": null,
      "workspace_approved": null,
      "sharing": {
        "subjects": "[]",
        "recipient": "private"
      },
      "current_user_permission": {
        "can_delete": true,
        "can_export": true,
        "can_read": true,
        "can_write": true,
        "can_share": true,
        "can_view_config": true
      },
      "gizmo_type": "snorlax",
      "context_stuffing_budget": 49152,
      "conversation_copy_in_progress": false,
      "gizmo_snorlax_type": null,
      "memory_enabled": true,
      "memory_scope": "global",
      "goal": null
    },
    "tools": "[]",
    "files": "[]",
    "product_features": "{attachments: {…}}"
  },
  "isActive": true
}
```



### project-chat (class: ps-9)

```json
{
  "className": "ps-9",
  "conversation": {
    "id": "",
    "title": "",
    "create_time": "2025-11-07T09:42:01.352818Z",
    "update_time": "2025-11-07T11:52:07.399687Z",
    "pinned_time": null,
    "mapping": null,
    "current_node": null,
    "conversation_template_id": "",
    "gizmo_id": "",
    "is_archived": false,
    "is_starred": null,
    "is_do_not_remember": false,
    "memory_scope": "global_enabled",
    "context_scopes": null,
    "context_scopes_v2": null,
    "workspace_id": null,
    "async_status": null,
    "safe_urls": "[]",
    "blocked_urls": "[]",
    "conversation_origin": null,
    "snippet": "",
    "sugar_item_id": null,
    "sugar_item_visible": false,
    "owner": {
      "user_id": "",
      "user_email": "",
      "name": "",
      "avatar_url": ""
    }
  },
  "isActive": false
}
```
