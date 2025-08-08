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
    SQReq[/StoreQueryRequest/]:::wireType
    SQResp[/StoreQueryResponse/]:::wireType
    WMsg[/WakuMessage/]:::wireType

    %% SDK/API Types
    IDMsg[/IDecodedMessage/]:::sdkType
    IDec[/IDecoder<T>/]:::sdkType
    QParams[/QueryRequestParams/]:::sdkType

    %% Core/Internal Types
    Cursor[/StoreCursor/]:::coreType

    %% Components/Processes
    SDK_Store{{Store}}:::processNode
    SDK_PM{{PeerManager}}:::processNode
    CORE_Store{{StoreCore}}:::processNode
    CORE_SM{{StreamManager}}:::processNode

    %% External Systems
    Libp2p[/libp2p\]:::externalNode
    Remote[/Remote Waku Store Node\]:::externalNode

    %% Functions (Methods)
    queryGen(Store.queryGenerator):::functionNode
    buildParams(buildQueryParams):::functionNode
    getPeer(Store.getPeerToUse):::functionNode

    queryPerPage(StoreCore.queryPerPage):::functionNode
    getStream(StreamManager.getStream):::functionNode
    encodeReq(StoreQueryRequest.create):::functionNode
    lpEncode(lp.encode):::functionNode
    lpDecode(lp.decode):::functionNode
    decodeResp(StoreQueryResponse.decode):::functionNode
    toProtoMsg(toProtoMessage):::functionNode
    decodeFromProto(decoder.fromProtoObj):::functionNode

    %% ============== Flows ==============
    %% User triggers query generator
    User --> queryGen --> SDK_Store --> buildParams
    IDec -.-> queryGen
    QParams -.-> queryGen

    %% Select peer and invoke core per query option
    buildParams --> getPeer --> SDK_PM
    SDK_Store --> queryPerPage --> CORE_Store

    %% Core: build request and stream
    queryPerPage --> encodeReq --> SQReq
    queryPerPage --> getStream --> CORE_SM

    %% Send over libp2p
    SQReq --> lpEncode --> Libp2p --> Remote

    %% Receive and decode
    Remote --> Libp2p --> lpDecode --> decodeResp --> SQResp

    %% Map to decoder promises (per message)
    SQResp -.-> WMsg
    WMsg -.-> toProtoMsg
    toProtoMsg --> decodeFromProto --> IDMsg

    %% Yield page of promises back to SDK and user
    CORE_Store --> SDK_Store --> User

    %% Emphasis styles to make components and externals larger/more central
    style SDK_Store font-size:18px,stroke-width:3px
    style SDK_PM font-size:18px,stroke-width:3px
    style CORE_Store font-size:18px,stroke-width:3px
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
