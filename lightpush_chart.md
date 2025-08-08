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
    LPR[/PushRequest/]:::wireType
    LPS[/PushResponse/]:::wireType
    LPRpc[/PushRpc/]:::wireType
    WMsg[/WakuMessage/]:::wireType

    %% SDK/API Types
    IMsg[/IMessage/]:::sdkType
    IEnc[/IEncoder/]:::sdkType
    SDKRes[/SDKProtocolResult/]:::sdkType
    SOptions[/ISendOptions/]:::sdkType

    %% Core/Internal Types
    CPR[/CoreProtocolResult/]:::coreType

    %% Components/Processes
    SDK_LP{{LightPush}}:::processNode
    SDK_PM{{PeerManager}}:::processNode
    SDK_RM{{RetryManager}}:::processNode
    CORE_LP{{LightPushCore}}:::processNode
    CORE_SM{{StreamManager}}:::processNode

    %% External Systems
    Libp2p[/libp2p\]:::externalNode
    Remote[/Remote Waku Node\]:::externalNode

    %% Functions (Methods)
    send1(LightPush.send):::functionNode
    getPeers(PeerManager.getPeers):::functionNode
    aggregate(SDK aggregate results):::functionNode
    retryPush(RetryManager.push):::functionNode

    send2(LightPushCore.send):::functionNode
    prep(preparePushMessage):::functionNode
    sizeCheck(isMessageSizeUnderCap):::functionNode
    toProto(toProtoObj):::functionNode
    createPush(PushRpc.createRequest):::functionNode

    getStream(StreamManager.getStream):::functionNode
    lpEncode(lp.encode):::functionNode
    lpDecode(lp.decode):::functionNode
    encRpc(PushRpc.encode):::functionNode
    decRpc(PushRpc.decode):::functionNode

    %% ============== Flows ==============
    %% User input to SDK send
    User --> send1 --> SDK_LP --> getPeers --> SDK_PM
    IEnc -.-> send1
    IMsg -.-> send1
    SOptions -.-> send1

    %% SDK selects peers and calls Core send (per peer)
    SDK_LP --> send2 --> CORE_LP

    %% Core prepare and encode
    send2 --> prep
    prep --> sizeCheck
    prep --> toProto
    toProto --> WMsg
    prep --> createPush --> LPRpc

    %% Stream and wire path
    send2 --> getStream --> CORE_SM
    LPRpc --> encRpc --> lpEncode --> Libp2p --> Remote

    %% Response path back
    Remote --> Libp2p --> lpDecode --> decRpc --> LPRpc
    decRpc --> LPS --> CPR --> SDK_LP

    %% SDK aggregates results to SDKProtocolResult
    SDK_LP --> aggregate --> SDKRes --> User

    %% Auto-retry side path
    aggregate --> retryPush --> SDK_RM --> send2

    %% Parameter flows
    IEnc -.-> toProto
    IMsg -.-> toProto

    %% Emphasis styles to make components and externals larger/more central
    style SDK_LP font-size:18px,stroke-width:3px
    style SDK_PM font-size:18px,stroke-width:3px
    style SDK_RM font-size:18px,stroke-width:3px
    style CORE_LP font-size:18px,stroke-width:3px
    style CORE_SM font-size:18px,stroke-width:3px
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
