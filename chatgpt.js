require('dotenv').config();

class ChatGPTClass {
  constructor(apiKey) {
    // Validación para asegurarse de que la clave de la API esté presente
    if (!apiKey) {
      throw new Error('La clave de la API es necesaria para inicializar ChatGPTClass');
    }

    this.apiKey = apiKey;
    this.conversationId = this.generateNewID();
    this.queue = [];
    this.tokenCount = 0;

    // Inicialización de la API
    this.init();
  }

  // Método para generar un ID único para la conversación
  generateNewID() {
    return Math.random().toString(36).substr(2, 9);
  }

  // Método de inicialización para importar y configurar la API de ChatGPT
  async init() {
    try {
      const { ChatGPTAPI } = await import('chatgpt');
      this.openai = new ChatGPTAPI({ apiKey: this.apiKey });
    } catch (error) {
      console.error('Error durante la inicialización de ChatGPTAPI:', error);
    }
  }

  // Método para manejar mensajes con ChatGPT, incluye validaciones y manejo de errores
  async handleMsgChatGPT(body) {
    try {
      console.log('Mensaje enviado a la API:', body);

      // Validación del cuerpo del mensaje
      if (!body || typeof body !== 'string') {
        throw new Error('El cuerpo del mensaje no es válido');
      }

      // Truncar mensajes largos
      if (body.length > 500) {
        console.warn('El mensaje es muy largo.');
        body = body.substring(0, 500);
      }

      // Envío de mensajes y manejo de la respuesta
      const response = await this.openai.sendMessage(body, {
        conversationId: this.conversationId,
        parentMessageId: this.queue.length ? this.queue[this.queue.length - 1].id : undefined,
        maxTokens: 100,
        temperature: 0.6,
        stopSequence: '\n',
      });

      this.queue.push(response);

      if (response.detail && response.detail.usage && response.detail.usage.total_tokens) {
        this.tokenCount += response.detail.usage.total_tokens;
        console.log('Tokens usados:', this.tokenCount);
      } else {
        console.error('Error al recuperar los tokens.');
      }

      return response;
    } catch (error) {
      console.error('Error al enviar el mensaje a la API:', error);
    }
  }

  // Método para enviar mensajes, actúa como un wrapper para handleMsgChatGPT
  async sendMessage(body) {
    return await this.handleMsgChatGPT(body);
  }

  // Método para terminar la conversación y limpiar el contexto
  endConversation() {
    this.conversationId = this.generateNewID();
    this.queue = [];
    this.tokenCount = 0;
    console.log('La conversación ha terminado y el contexto ha sido limpiado.');
  }
}

module.exports = ChatGPTClass;