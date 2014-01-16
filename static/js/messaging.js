var SOCKET_URL = "http://54.212.10.20:8000/echo";

function MessageClient(socketUrl, sockOpenedCb) {
    this.id = null;
    var self = this;
    self.channels = {};

    // override these
    this.directMessage = function(sender, message) {
        console.log("direct message from: " + sender + ": " + message);
        console.log("you didnt' override " + this.directMessage);
    };

    this.channelMessage = function(channel, sender, message) {
        console.log("channel message on " + channel + " from: " + sender + ": " + message);
        console.log("you didnt' override " + this.channelMessage);
    };

    this.onSocketOpen = sockOpenedCb || function() {};

    this.onSocketClose = function() {
        self.id = null;
    };

    this.onSocketConnected = function(message) {
        self.id = message;
    };

    this.handleChannelMessage = function(message) {
        cr = message.splitFirst(":");
        sm = cr[1].splitFirst(":");
        self.channelMessage(cr[0], sm[0], sm[1]);
    };

    this.handleDirectMessage = function(message) {
        dm = message.splitFirst(":");
        self.directMessage(dm[0], dm[1]);
    };

    this.onSubscribe = function(message) {
        self.channels[message] = true;
    };

    this.handleRawMessage = function(rawMessage) {
        messageType = rawMessage.substr(0, 3);
        message = rawMessage.substr(4);

        switch(messageType) {
        case "sub": {
            self.onSubscribe(message);
            break;
        }
        case "pub": {
            self.handleChannelMessage(message);
            break;
        }
        case "con": {
            self.onSocketConnected(message);
            break;
        }
        case "msg": {
            self.handleDirectMessage(message);
            break;
        }
        default: {
            console.log("unrecognized message: " + rawMessage);
        }
        }
    };

    this.onSocketMessage = function(e) {
        self.handleRawMessage(e.data);
    };

    this.sendRawMessage = function(rawMessage) {
        self.sock.send(rawMessage);
    };

    this.subscribeToChannel = function(channelName) {
        self.sendRawMessage("sub:" + channelName);
    };

    this.publishMessage = function(channelName, message) {
        if (channelName in self.channels) {
            self.sendRawMessage("pub:" + channelName + ":" + message);
            return true;
        }
        return false;
    };

    this.sendDirectMessage = function(recipient, message) {
        self.sendRawMessage("msg:" + recipient + ":" + message);
        return true;
    };

    this.sock = new SockJS(socketUrl);
    this.sock.onopen = self.onSocketOpen;
    this.sock.onmessage = self.onSocketMessage;
    this.sock.onclose = self.onSocketClose;
}


function JSONClient(SOCKET_URL) {
    var self = this;
    this.callbacks = {};

    this.messageClient = new MessageClient(SOCKET_URL, function() {
        self.messageClient.subscribeToChannel(self.channelName);
    });

    this.decodeMessage = function(message) {
        return JSON.parse(message);
    };

    this.encodeMessage = function(message) {
        return JSON.stringify(message);
    };

    this.registerCallbackForType = function(messageType, callback) {
        if (!(messageType in self.callbacks)) {
            self.callbacks[messageType] = new Array();
        }
        self.callbacks[messageType].push(callback);
    }

    this.handleMessage = function(sender, message) {
        var decoded = self.decodeMessage(message);
        var messageType = decoded['type'];

        if (!(messageType in self.callbacks)) {
            console.log("WARNING: no handlers registered for message type: " + messageType);
            return
        }

        for (var i = 0; i < self.callbacks[messageType].length; i++) {
            self.callbacks[messageType][i](sender, decoded);
        }
    };

    // Override these
    this.messageClient.directMessage = function(sender, message) {
        self.handleMessage(sender, message);
    };

    this.messageClient.channelMessage = function(channel, sender, message) {
        self.handleMessage(sender, message);
    };

    this.sendDirectMessage = function(recipient, message) {
        self.messageClient.sendDirectMessage(recipient, self.encodeMessage(message));
    };

    this.subscribeToChannel = function(channel) {
        self.messageClient.subscribeToChannel(channel);
    };

    this.publishMessageToChannel = function(channel, message) {
        self.messageClient.publishMessage(channel, self.encodeMessage(message));
    };

};

function SyncedClock(jsonClient) {
    var self = this;
    this.peerOffsets = {};
    this.peerLatencies = {};
    this.channelName = "#sync";  // TODO(tylerw): move this somewhere configurable.
    this.numSamples = 10;

    this.client = jsonClient;
    this.client.subscribeToChannel(self.channelName);

    this.getTimeMs = function() {
        return new Date().getTime();
    };

    this.handleTimeRequest = function(sender, requestPacket) {
        var response = {
            type: "response_time",
            received_time: self.getTimeMs(), // should be set earlier in the call chain.
            time: self.getTimeMs(),
            requested_time: requestPacket.time,
        };
        self.client.sendDirectMessage(sender, response);
    };

    this.handleTimeResponse = function(sender, responsePacket) {
        var rcvTime = self.getTimeMs();
        var reqSent = responsePacket['requested_time'];
        var reqRcvd = responsePacket['received_time'];
        var rspSent = responsePacket['time'];
        var transitTime = (rcvTime - reqSent - (rspSent - reqRcvd)) / 2;
        var now = self.getTimeMs();
/*
        console.log("time on network: " + transitTime + " ms");
        console.log("local  time: " + now + " ms");
        console.log("remote time: " + rspSent + transitTime + " ms");
        console.log(sender + " time delta: " + (now - (rspSent + transitTime)) + " ms");
*/
        if (!(sender in self.peerOffsets)) {
            self.peerOffsets[sender] = new Array();
        }
        self.peerOffsets[sender].push((now - (rspSent + transitTime)));
        if (self.peerOffsets[sender].length > self.numSamples) {
            self.peerOffsets[sender].shift();
        }
    }

    this.pollPeers = function() {
        var request = {
            type: "request_time",
            time: self.getTimeMs(),
        };
        this.client.publishMessageToChannel(self.channelName, request);
    };

    this.getMaxPeerLatency = function() {

    };
    this.client.registerCallbackForType("request_time", self.handleTimeRequest);
    this.client.registerCallbackForType("response_time", self.handleTimeResponse);
}
