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
    %% User Interface (entry points)
    User[[User Application]]:::userNode

    %% Core Components
    CM{{ConnectionManager}}:::processNode
    DD{{DiscoveryDialer}}:::processNode
    DIAL{{Dialer}}:::processNode
    CL{{ConnectionLimiter}}:::processNode
    KAM{{KeepAliveManager}}:::processNode
    NM{{NetworkMonitor}}:::processNode
    SR{{ShardReader}}:::processNode

    %% External Systems
    LP2P[/libp2p\]:::externalNode
    PStore[/libp2p PeerStore\]:::externalNode
    RELAY[/Relay\]:::externalNode
    BNET[/Browser Network\]:::externalNode

    %% Data Types / Events
    CMOpts[/ConnectionManagerOptions/]:::coreType
    KAOpts[/KeepAliveOptions/]:::coreType
    ShardInfo[/ShardInfo/]:::wireType
    PeerPingMeta[/PeerStore metadata ping/]:::wireType
    PeerShardMeta[/PeerStore metadata shardInfo/]:::wireType
    E_DISC[/libp2p 'peer:discovery'/]:::wireType
    E_CONN[/libp2p 'peer:connect'/]:::wireType
    E_DISCNT[/libp2p 'peer:disconnect'/]:::wireType
    E_NET[/browser online or offline/]:::wireType
    E_WAKU[/IWaku 'waku:connection' event/]:::wireType

    %% API Functions
    CM_start(start):::functionNode
    CM_stop(stop):::functionNode
    CM_dial(dial):::functionNode
    CM_hang(hangUp):::functionNode
    CM_peers(getConnectedPeers):::functionNode

    %% Subsystem Functions
    DD_onDisc(onPeerDiscovery):::functionNode
    DIAL_enqueue(enqueue dial):::functionNode
    DIAL_process(process queue):::functionNode
    DIAL_should(skip peer checks):::functionNode

    CL_onConnEvt(onWakuConnectionEvent):::functionNode
    CL_onDiscEvt(onDisconnectedEvent):::functionNode
    CL_maintain(maintainConnections):::functionNode

    KAM_startPeer(startPingForPeer):::functionNode
    KAM_stopPeer(stopPingForPeer):::functionNode
    KAM_relayTick(relayKeepAliveTick):::functionNode

    NM_onConn(onConnectedEvent):::functionNode
    NM_onDisc(onDisconnectedEvent):::functionNode
    NM_dispatch(dispatchNetworkEvent):::functionNode

    SR_has(hasShardInfo):::functionNode
    SR_onTopic(isPeerOnTopic):::functionNode
    SR_onShard(isPeerOnShard):::functionNode

    %% ============== Flows ==============
    %% User controls ConnectionManager
    User --> CM_start --> CM
    User --> CM_stop --> CM
    User --> CM_dial --> CM
    User --> CM_hang --> CM
    User --> CM_peers --> CM

    %% Config into components
    CMOpts -.-> CM
    KAOpts -.-> KAM

    %% Composition wiring
    CM --> DD
    CM --> DIAL
    CM --> CL
    CM --> KAM
    CM --> NM
    CM --> SR

    %% Discovery to Dial path
    E_DISC --> DD_onDisc --> DD
    DD --> PStore
    DD --> DIAL_enqueue --> DIAL
    DIAL --> DIAL_should --> SR
    SR --> PStore
    DIAL --> DIAL_process --> LP2P

    %% Direct dial API
    CM_dial --> LP2P

    %% Maintain connections periodic
    CL --> CL_maintain --> LP2P

    %% Auto-recovery on disconnect
    E_DISCNT --> NM_onDisc --> NM --> E_WAKU
    E_DISCNT --> CL_onDiscEvt --> CL --> DIAL_enqueue
    E_WAKU --> CL_onConnEvt --> CL --> DIAL_enqueue --> DIAL

    %% Connectivity propagation from libp2p and browser
    E_CONN --> NM_onConn --> NM --> E_WAKU
    E_NET --> NM_dispatch --> NM --> E_WAKU

    %% Keepalive on peer connect
    E_CONN --> KAM_startPeer --> KAM --> LP2P
    KAM --> PeerPingMeta --> PStore
    KAM_relayTick --> RELAY

    %% getConnectedPeers reads PeerStore and uses ping
    CM_peers --> PStore
    PeerPingMeta -.-> CM_peers

    %% Shard gating reads shard info
    PeerShardMeta -.-> SR_has
    SR_has -.-> SR

    %% Browser network external source
    BNET --> E_NET

    %% Emphasis styles for components and externals
    style CM font-size:18px,stroke-width:3px
    style DD font-size:18px,stroke-width:3px
    style DIAL font-size:18px,stroke-width:3px
    style CL font-size:18px,stroke-width:3px
    style KAM font-size:18px,stroke-width:3px
    style NM font-size:18px,stroke-width:3px
    style SR font-size:18px,stroke-width:3px
    style LP2P font-size:18px,stroke-width:3px
    style PStore font-size:18px,stroke-width:3px
    style RELAY font-size:18px,stroke-width:3px
    style BNET font-size:18px,stroke-width:3px

    %% ============== Legend (shapes + colors) ==============
    subgraph Legend
        direction TB
        L1[[User Interface]]:::userNode
        L2{{Component}}:::processNode
        L3[/External System\]:::externalNode
        L4[/Data Type/]:::wireType
        L5(Function):::functionNode
        LC_wire[Wire Format/Protocol or Events]:::wireType
        LC_core[Core/Internal Types]:::coreType
        LC_process[Components/Processes]:::processNode
        LC_external[External Systems]:::externalNode
        LC_function[Functions/Methods]:::functionNode
        LC_user[User Interface]:::userNode
    end
    ```
