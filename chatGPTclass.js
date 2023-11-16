require('dotenv').config();
const axios = require('axios');
const openaiUrl = 'https://api.openai.com/v1/chat/completions';

class ChatTurbo {
    queues = {};

    constructor() {
        this.optionsGPT = {
            model: "babbage-002",
            temperature: 0.7,
            max_tokens: 250,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        };
    }

    addSystemMessage = (conversationId, body) => {
        if (!this.queues[conversationId]) {
            this.queues[conversationId] = [];
        }
        this.queues[conversationId].push({ role: 'system', content: body });
    };

    addUserMessage = (conversationId, body) => {
        if (!this.queues[conversationId]) {
            throw new Error('A system message must be added first.');
        }
        this.queues[conversationId].push({ role: 'user', content: body });
    };

    addAssistantMessage = (conversationId, body) => {
        if (!this.queues[conversationId]) {
            throw new Error('A system message must be added first.');
        }
        this.queues[conversationId].push({ role: 'assistant', content: body });
    };

    resetConversation = (conversationId) => {
        this.queues[conversationId] = [];
    };

    removeLastAssistantMessage = (conversationId) => {
        if (this.queues[conversationId] && this.queues[conversationId].length > 0) {
            const lastMessage = this.queues[conversationId][this.queues[conversationId].length - 1];
            if (lastMessage.role === 'assistant') {
                this.queues[conversationId].pop();
            }
        }
    };

    removeLastUserMessage = (conversationId) => {
        if (this.queues[conversationId] && this.queues[conversationId].length > 0) {
            const lastMessage = this.queues[conversationId][this.queues[conversationId].length - 1];
            if (lastMessage.role === 'user') {
                this.queues[conversationId].pop();
            }
        }
    };

    handleMsgChatGPT = async (conversationId) => {
        // Verificar si la conversación existe antes de continuar
        if (!this.queues[conversationId]) {
            throw new Error('La conversación no existe o no ha sido inicializada.');
        }

        const conversation = this.queues[conversationId];

        // Filtrar y mostrar solo los mensajes del usuario y del asistente antes de enviar la solicitud
        const filteredConversation = conversation.filter(message => message.role === 'user' || message.role === 'assistant');
        console.log(`Estado actual de la conversación [${conversationId}] antes de la solicitud:`, filteredConversation);

        let attempts = 0;
        const maxAttempts = 10;
        let waitTime = 5000;

        while (attempts < maxAttempts) {
            try {
                const headers = {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                };

                const data = {
                    model: this.optionsGPT.model,
                    messages: conversation,
                    temperature: this.optionsGPT.temperature,
                    max_tokens: this.optionsGPT.max_tokens,
                    top_p: this.optionsGPT.top_p,
                    frequency_penalty: this.optionsGPT.frequency_penalty,
                    presence_penalty: this.optionsGPT.presence_penalty
                };

                const response = await axios.post(openaiUrl, data, { headers: headers });

                const assistantMessage = response.data.choices[0].message.content;
                this.queues[conversationId].push({ role: 'assistant', content: assistantMessage });

                // Extrae y muestra el total de tokens utilizados en la llamada a la API.
                const totalTokens = response.data.usage.total_tokens;
                console.log(`Total de tokens utilizados Normal: ${totalTokens}`);

                console.log(`Estado actual de la conversación [${conversationId}] después de la solicitud:`, this.queues[conversationId].filter(message => message.role === 'user' || message.role === 'assistant'));

                return assistantMessage;
            } catch (error) {
                if (error.response && error.response.status === 503) {
                    attempts++;
                    console.log(`Intento ${attempts} fallido. Esperando ${waitTime / 1000} segundos antes de volver a intentar...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    waitTime *= 2;
                } else {
                    throw error;
                }
            }
        }

        throw new Error("Se alcanzó el número máximo de intentos. No se pudo enviar el mensaje a ChatGPT.");
    };
}

module.exports = ChatTurbo;
