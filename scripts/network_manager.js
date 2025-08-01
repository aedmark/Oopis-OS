// scripts/network_manager.js

class NetworkManager {
    constructor() {
        this.instanceId = `oos-${Date.now()}-${Math.floor(Math.random() * 100)}`;
        this.channel = new BroadcastChannel('oopisos-network');
        this.dependencies = {};
        this.listenCallback = null;
        this.messageQueue = [];
        this.pingCallbacks = new Map();

        this.signalingServerUrl = 'ws://localhost:8080';
        this.websocket = null;
        this.peers = new Map();
        this.remoteInstances = new Set();

        this.channel.onmessage = this._handleBroadcastMessage.bind(this);
        this._initializeSignaling();

        console.log(`NetworkManager initialized with ID: ${this.instanceId}`);
    }

    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    getInstanceId() {
        return this.instanceId;
    }

    getRemoteInstances() {
        return Array.from(this.remoteInstances);
    }

    getPeers() {
        return this.peers;
    }

    setListenCallback(callback) {
        this.listenCallback = callback;
    }

    _handleBroadcastMessage(event) {
        this._processIncomingMessage(event.data);
    }

    _initializeSignaling() {
        this.websocket = new WebSocket(this.signalingServerUrl);

        this.websocket.onopen = () => {
            console.log('Connected to signaling server.');
            const presencePayload = { type: 'discover', sourceId: this.instanceId };
            this.websocket.send(JSON.stringify(presencePayload));
        };

        this.websocket.onmessage = async (event) => {
            try {
                let messageData = event.data;
                if (messageData instanceof Blob) {
                    messageData = await messageData.text();
                }
                const payload = JSON.parse(messageData);
                if (payload.sourceId === this.instanceId) return;

                switch (payload.type) {
                    case 'discover':
                        if (!this.remoteInstances.has(payload.sourceId)) {
                            this.remoteInstances.add(payload.sourceId);
                            const presencePayload = { type: 'discover', sourceId: this.instanceId };
                            this.websocket.send(JSON.stringify(presencePayload));
                        }
                        break;
                    case 'offer': await this._handleOffer(payload); break;
                    case 'answer': await this._handleAnswer(payload); break;
                    case 'candidate': await this._handleCandidate(payload); break;
                    case 'ping': case 'pong': case 'direct_message':
                        this._processIncomingMessage(payload);
                        break;
                }
            } catch (error) {
                console.error('Error parsing signaling message:', error);
            }
        };

        this.websocket.onclose = () => {
            console.log('Disconnected from signaling server. Reconnecting in 5s...');
            setTimeout(() => this._initializeSignaling(), 5000);
        };

        this.websocket.onerror = (error) => console.error('Signaling server error:', error);
    }

    _sendSignalingMessage(payload) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(payload));
        }
    }

    async _createPeerConnection(targetId) {
        if (this.peers.has(targetId)) return this.peers.get(targetId);

        const peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this._sendSignalingMessage({ type: 'candidate', targetId, sourceId: this.instanceId, candidate: event.candidate });
            }
        };
        peerConnection.ondatachannel = (event) => this._setupDataChannel(event.channel, targetId);
        this.peers.set(targetId, peerConnection);
        return peerConnection;
    }

    _setupDataChannel(dataChannel, peerId) {
        dataChannel.onopen = () => console.log(`Data channel with ${peerId} is open.`);
        dataChannel.onmessage = (event) => this._processIncomingMessage(JSON.parse(event.data));
        dataChannel.onclose = () => {
            console.log(`Data channel with ${peerId} closed.`);
            this.peers.delete(peerId);
            this.remoteInstances.delete(peerId);
        };
    }

    async _handleOffer({ sourceId, offer }) {
        const peerConnection = await this._createPeerConnection(sourceId);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        this._sendSignalingMessage({ type: 'answer', targetId: sourceId, sourceId: this.instanceId, answer });
    }

    async _handleAnswer({ sourceId, answer }) {
        const peerConnection = this.peers.get(sourceId);
        if (peerConnection) await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }

    async _handleCandidate({ sourceId, candidate }) {
        const peerConnection = this.peers.get(sourceId);
        if (peerConnection?.remoteDescription && candidate) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error('Error adding ICE candidate', e);
            }
        }
    }

    async sendMessage(targetId, type, data) {
        const payload = { sourceId: this.instanceId, targetId, type, data, timestamp: Date.now() };

        this.channel.postMessage(payload);

        if (this.remoteInstances.has(targetId)) {
            let peerConnection = this.peers.get(targetId);
            if (!peerConnection || peerConnection.connectionState !== 'connected') {
                peerConnection = await this._createPeerConnection(targetId);
                const dataChannel = peerConnection.createDataChannel('oopisos-datachannel');
                this._setupDataChannel(dataChannel, targetId);

                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                this._sendSignalingMessage({ type: 'offer', targetId, sourceId: this.instanceId, offer });
            }

            const getDataChannel = () => {
                for (const [, pc] of this.peers) {
                    if (pc.sctp) {
                        const transport = pc.sctp.transport;
                        if (transport && transport.transport) {
                            const dataChannels = transport.transport.dataChannels;
                            if (dataChannels) {
                                const dc = Array.from(dataChannels).find(c => c.label === 'oopisos-datachannel');
                                if (dc) return dc;
                            }
                        }
                    }
                }
                return null;
            };

            const waitForDataChannel = new Promise((resolve, reject) => {
                const check = () => {
                    const dc = getDataChannel();
                    if (dc && dc.readyState === 'open') {
                        resolve(dc);
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
                setTimeout(() => reject(new Error('Data channel timeout')), 5000);
            });

            try {
                const dc = await waitForDataChannel;
                dc.send(JSON.stringify(payload));
            } catch (error) {
                console.error(`WebRTC send failed to ${targetId}:`, error);
                this._sendSignalingMessage(payload);
            }
        } else if (this.websocket.readyState === WebSocket.OPEN) {
            this._sendSignalingMessage(payload);
        }
    }

    _processIncomingMessage(payload) {
        const { sourceId, targetId, type, data, timestamp } = payload;
        if (targetId !== this.instanceId && targetId !== 'broadcast') return;

        if (type === 'pong') {
            const callback = this.pingCallbacks.get(sourceId);
            if (callback) {
                callback(Date.now() - timestamp);
                this.pingCallbacks.delete(sourceId);
            }
            return;
        }

        if (type === 'ping') {
            this.sendMessage(sourceId, 'pong', 'PONG');
            return;
        }

        if (this.listenCallback) {
            this.listenCallback(payload);
        } else {
            this.messageQueue.push(payload);
        }
    }

    sendPing(targetId) {
        return new Promise((resolve, reject) => {
            this.pingCallbacks.set(targetId, resolve);
            this.sendMessage(targetId, 'ping', 'PING');
            setTimeout(() => {
                if (this.pingCallbacks.has(targetId)) {
                    this.pingCallbacks.delete(targetId);
                    reject(new Error('Ping timed out'));
                }
            }, 5000);
        });
    }

    getNextMessage() {
        return this.messageQueue.shift() || null;
    }
}