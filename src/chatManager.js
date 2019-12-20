const EventEmitter = require("events").EventEmitter;
const pb = require("protobufjs");
const msgTypes = require('./picartoMessageTypes');

class picartoChatManager extends EventEmitter {

  /**
   * 
   * @param {WebSocket} chat 
   */
  constructor(chat) {
    super();
    this.chat = chat;
    this.init.bind(this);
    this.init();
  }

  async init() {
    /**
     * Handles incoming messages from the picarto server
     * @param {Buffer} msg 
     * @param {pb.Root} protocol
     */
    const messageHandler = (msg, protocol) => {
      const msgType = protocol.lookupType(msgTypes[msg[0]]);
      const decoded = msgType.decode(msg.slice(1));
      // console.log(decoded);
      this.emit(msgTypes[msg[0]], msgType.decode(msg.slice(1)));
    }

    this.root = await pb.load(`${__dirname}/picartoChat.proto`).then();
    this.chat.on("message", (msg) => messageHandler(msg, this.root)); 
  }

  createOutgoingMessage(type, payload) {
    const msgType = this.root.lookupType(type);
    const message = msgType.create({...payload});
    return Buffer.concat([Buffer.from([msgTypes.indexOf(type)]), msgType.encode(message).finish()]);
  }

  sendMessage = async (msg) => {
    const outgoing = this.createOutgoingMessage("NewMessage", {
      message: msg
    })
    this.chat.send(outgoing);
  }

  removeMessage = async (msg) => {
    const outgoing = this.createOutgoingMessage("RemoveMessage", {
      id: msg.id,
    })
    this.chat.send(outgoing);
  }

  sendWhisper = async (user, message) => {
    message = `/w ${user} ${message}`;
    const outgoing = this.createOutgoingMessage("NewMessage", {
      message
    })
    this.chat.send(outgoing);
  }

  banUser = async (user, isShadowBan) => {
    const message = `/${isShadowBan ? 'shadowban' : 'ban'} ${user}`;
    const outgoing = this.createOutgoingMessage("NewMessage", {
      message
    })
    console.log(message);
    this.chat.send(outgoing);
  }
}

module.exports = picartoChatManager;