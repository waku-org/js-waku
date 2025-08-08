```mermaid
graph TB
    %% ============== Style definitions ==============
    classDef wireType fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef sdkType fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef coreType fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef processNode fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    classDef externalNode fill:#fce4ec,stroke:#ad1457,stroke-width:2px
    classDef functionNode fill:#ffebee,stroke:#c62828,stroke-width:1px
    classDef userNode fill:#e0f2f1,stroke:#00695c,stroke-width:2px

    %% ============== Nodes (no layer grouping) ==============
    %% User Interface
    User[[User Application]]:::userNode

    %% Wire Types (Protocol)
    FSReq[/FilterSubscribeRequest/]:::wireType
    FSResp[/FilterSubscribeResponse/]:::wireType
    MPush[/MessagePush/]:::wireType
    WMsg[/WakuMessage/]:::wireType

    %% SDK/API Types
    IDec[/IDecoder<T>/]:::sdkType
    IDMsg[/IDecodedMessage/]:::sdkType
    CB[/Callback<T>/]:::sdkType
    FOpts[/FilterProtocolOptions/]:::sdkType

    %% Core/Internal Types
    CPR[/CoreProtocolResult/]:::coreType

    %% Components/Processes
    S_Filter{{Filter}}:::processNode
    S_Sub{{Subscription}}:::processNode
    C_Filter{{FilterCore}}:::processNode
    C_StreamMgr{{StreamManager}}:::processNode

    %% External Systems
    Libp2p[/libp2p\]:::externalNode
    Remote[/Remote Waku Node\]:::externalNode

    %% Functions (Methods)
    subscribe1(subscribe):::functionNode
    unsubscribe1(unsubscribe):::functionNode
    subAdd(add):::functionNode
    subRemove(remove):::functionNode
    subInvoke(invoke):::functionNode
    onIncoming(filter.onIncomingMessage):::functionNode
    keepAliveTick(keepAlive tick):::functionNode

    subscribe2(FilterCore.subscribe):::functionNode
    unsubscribe2(FilterCore.unsubscribe):::functionNode
    ping2(FilterCore.ping):::functionNode
    getStream(StreamManager.getStream):::functionNode
    createSubReq(FilterSubscribeRpc.createSubscribeRequest):::functionNode
    createUnsubReq(FilterSubscribeRpc.createUnsubscribeRequest):::functionNode
    createPingReq(FilterSubscribeRpc.createSubscriberPingRequest):::functionNode
    decodeSubResp(FilterSubscribeResponse.decode):::functionNode
    onPush(FilterCore.onRequest):::functionNode
    decodePush(FilterPushRpc.decode):::functionNode

    %% ============== Flows ==============
    %% User input to SDK subscribe
    User --> subscribe1 --> S_Filter --> subAdd --> S_Sub
    IDec -.-> subscribe1
    CB -.-> subscribe1
    FOpts -.-> S_Sub

    %% Subscription to Core: SUBSCRIBE
    S_Sub --> subscribe2 --> C_Filter
    subscribe2 --> getStream --> C_StreamMgr
    subscribe2 --> createSubReq --> FSReq
    FSReq --> Libp2p --> Remote

    %% Response path (SUBSCRIBE, UNSUBSCRIBE, PING)
    Remote --> Libp2p --> FSResp --> decodeSubResp --> CPR --> S_Sub

    %% Incoming PUSH (remote -> app)
    Remote --> Libp2p --> MPush --> decodePush --> onPush --> C_Filter
    C_Filter --> onIncoming --> S_Filter --> S_Sub
    WMsg -.-> subInvoke
    IDec -.-> subInvoke
    subInvoke --> IDMsg --> CB

    %% Unsubscribe flow
    User --> unsubscribe1 --> S_Filter --> subRemove --> S_Sub
    S_Sub --> unsubscribe2 --> C_Filter
    unsubscribe2 --> getStream
    unsubscribe2 --> createUnsubReq --> FSReq --> Libp2p --> Remote

    %% Keep-alive ping flow
    S_Sub --> keepAliveTick --> ping2 --> C_Filter
    ping2 --> getStream
    ping2 --> createPingReq --> FSReq --> Libp2p --> Remote

    %% Emphasis styles to make components and externals larger/more central
    style S_Filter font-size:18px,stroke-width:3px
    style S_Sub font-size:18px,stroke-width:3px
    style C_Filter font-size:18px,stroke-width:3px
    style C_StreamMgr font-size:18px,stroke-width:3px
    style Libp2p font-size:18px,stroke-width:3px
    style Remote font-size:18px,stroke-width:3px

    %% ============== Legend (shapes + colors) ==============
    subgraph Legend
        direction TB
        %% Shape legend (with corresponding colors)
        L1[[User Interface]]:::userNode
        L2{{Component}}:::processNode
        L3[/External System\]:::externalNode
        L4[/Data Type/]:::wireType
        L5(Function):::functionNode
        %% Color legend
        LC_wire[Wire Format/Protocol]:::wireType
        LC_sdk[SDK/API Types]:::sdkType
        LC_core[Core/Internal Types]:::coreType
        LC_process[Components/Processes]:::processNode
        LC_external[External Systems]:::externalNode
        LC_function[Functions/Methods]:::functionNode
        LC_user[User Interface]:::userNode
    end
    ```
