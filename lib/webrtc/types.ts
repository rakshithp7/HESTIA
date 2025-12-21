export type SessionMode = 'voice' | 'chat';

export type RTCSessionConfig = {
    topic: string;
    mode: SessionMode;
};

export interface ChatMessage {
    id: string;
    text: string;
    timestamp: number;
    sender: 'me' | 'peer';
}

export type DataChannelMessage =
    | { type: 'chat'; message: ChatMessage }
    | { type: 'typing_start' }
    | { type: 'typing_stop' };

export type ConnectionStatus =
    | 'idle'
    | 'waiting'
    | 'connecting'
    | 'connected'
    | 'permission-denied'
    | 'no-mic'
    | 'media-error'
    | 'ended';

export type SuggestedMatch = {
    queueId: string;
    topic: string;
    similarity: number;
    peerConsentedToMe: boolean;
};

export const CHAT_CHANNEL_LABEL = 'chat';
export const ICE_SERVERS: RTCIceServer[] = [
    {
        urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
        ],
    },
];

export const DEFAULT_RTC_CONFIG: RTCConfiguration = {
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
};
