let DATOS = {};
const { createBot, createProvider, createFlow, addKeyword, EVENTS, CoreClass } = require('@bot-whatsapp/bot')// Import necessary modules and libraries for bot creation.
const QRPortalWeb = require('./Services/portal')// Import the QRPortalWeb module for handling QR code-based authentication.
const BaileysProvider = require('@bot-whatsapp/provider/baileys')// Import the BaileysProvider module for WhatsApp bot functionality.
const MockAdapter = require('@bot-whatsapp/database/mock')// Import the MockAdapter module for mocking database functionality.
const { MYSQL_DB_HOST, MYSQL_DB_USER, MYSQL_DB_PASSWORD, MYSQL_DB_NAME, MYSQL_DB_PORT } = require('./data'); // Asegúrate de que la ruta sea correcta si el archivo data.js está en un directorio diferente.
const mysql = require('mysql2/promise');// Import the 'mysql2' library for database operations.
const ChatGPTClass = require('./chatgpt')// Import the ChatGPTClass for handling GPT-based chat interactions.
const { PROMPT } = require('./PROMPTS/prompt') // Import the PROMPT constant containing a long text for GPT conversations.
const { typing } = require('./stateWriting')// Import the 'typing' function for managing typing indicators.
const { readFileSync } = require("fs");
const { join } = require("path");

// Genera un identificador único de 5 caracteres de forma asíncrona
const generateUniqueID = async () => {
  const { nanoid } = await import('nanoid');
  return nanoid(5);
};

// Llama a la función asincrónica para obtener el identificador único
generateUniqueID()
  .then((ID_CONV) => {
    const ChatGPTClass = require('./chatgpt');
    global.chatGPTInstance = new ChatGPTClass(process.env.OPENAI_API_KEY, ID_CONV);
  })
  .catch((error) => {
    console.error('Error generando el identificador único:', error);
  });

//----------------------------------------------------------flowFinal---------------------------------------------------------------------
/**
 * Flow responsible for ending the chatbot when the user selects option 2 using endFlow, or if they choose option 1, return to the menu using gotoFlow.
 * endFlow(end BotIS)
 * gotoFlow(menú)
 */
let fallBackSecundario = 0
const flowFinal = addKeyword('##_flow_secundario_##')
  .addAnswer('👍 Muchas gracias por utilizar el chat Bot del programa de *Ingeniería de sistemas* de la *Universidad Mariana*. 👍')
  .addAnswer('Elige una opción: 👇🏼 ')
  .addAnswer(['*1.* Regresar al Menú 📚📌', '*2.* Para finalizar BotIS 🏁🤓'], { capture: true }, async (ctx, { fallBack, gotoFlow, endFlow }) => {

    if (ctx.body === '2') {
      return endFlow({ body: '*Chat Bot finalizado* , nos vemos luego. 👋🤓' })
    }
    else if (ctx.body === '1') {
      gotoFlow(flowMenu2)
    }
    else if (ctx.body !== '1' && ctx.body != '2') {
      if (fallBackSecundario < 3) {
        fallBackSecundario++;
        return fallBack('⚠️ *Selecciona una opcion valida* ⚠️ \n\nIngresa *1* para volver al menú principal o *2* para finalizar *BotIS*');
      } else if (fallBackSecundario === 3) {
        fallBackSecundario = 0;
        return endFlow({ body: '❌ *Opción no válida* ❌ \n\nChat Bot finalizado, nos vemos luego. 👋🤓' });
      }
    }
  })
//-------------------------------------------------------fin flowFinal-------------------------------------------------------------------

//--------------------------------------------------------flowPregunta-------------------------------------------------------------------
/**
 * Flow responsible for answering questions in natural language using artificial intelligence technologies through the consumption of OpenAI's API.
 */
//const chatGPTInstance = new ChatGPTClass();// Create an instance of the ChatGPTClass for GPT-based chat interactions.

const pool = mysql.createPool({
  host: MYSQL_DB_HOST,
  user: MYSQL_DB_USER,
  password: MYSQL_DB_PASSWORD,
  database: MYSQL_DB_NAME,
  port: MYSQL_DB_PORT
});

let cachedPrompt;

const getPrompt = async () => {
  if (!cachedPrompt) {
    const pathPromp = join(process.cwd(), "PROMPTS");
    cachedPrompt = readFileSync(join(pathPromp, "investigationPrompt.txt"), "utf-8");
  }
  return cachedPrompt;
};

const flowPregunta = addKeyword('##*flow_pregunta*##')
  .addAnswer('🤖 Conectando con la inteligencia artificial de *BotIS...* \n\nRecuerda que para volver al *menú principal*, solo necesitas escribir la palabra *salir*. 💻📲 \n\n*Por favor, espera un momento...*🕜', null, async (ctx, { flowDynamic, gotoFlow, provider }) => {
    await flowDynamic(`Hola ${ctx.pushName}`)
    await typing(provider, ctx, 4000);
    const dataBotIS = await getPrompt();
    await chatGPTInstance.handleMsgChatGPT(dataBotIS)
    // Puedes tomar medidas adicionales aquí en caso de error, como enviar un mensaje de error al usuario.
  })
  .addAnswer('✔️ *Todo esta listo* ✔️ \n\nEscribe tu pregunta sobre el proceso investigativo 🤔❓ de *Ingenieria de Sistemas* de la *Universidad Mariana*',
    { capture: true }, async (ctx, { flowDynamic, fallBack, gotoFlow, provider }) => {
      let warningTimeoutId;
      let endTimeoutId;
      let isChatActive = true;

      const setWarningTimer = () => {
        warningTimeoutId = setTimeout(() => {
          if (isChatActive) {
            flowDynamic('⏰ ¡Advertencia! Te quedan 5 minutos para realizar otra pregunta antes de que finalice BotIS. ⏰');
          }
        }, 5 * 60 * 1000); // 5 minutos
      };

      const setEndTimer = () => {
        endTimeoutId = setTimeout(async () => {
          if (isChatActive) {
            await flowDynamic('¡Ups! Parece que tu tiempo se ha agotado. Por favor, vuelve a intentarlo. 🙁🤖');
            chatGPTInstance.endConversation();
            gotoFlow(flowMenu2);
          }
        }, 10 * 60 * 1000); // 10 minutos
      };

      setWarningTimer();
      setEndTimer();

      try {
        const connection = await pool.getConnection();
        const response = await chatGPTInstance.handleMsgChatGPT(ctx.body)
        //const response = await chatGPTInstance.handleMsgChatGPT(ctx.from, ctx.body);
        const userQuestion = ctx.body.toString(); // La pregunta del usuario
        const chatbotResponse = response.text; // La respuesta del chatbot
        const phone = ctx.from;
        console.log(userQuestion);
        console.log(chatbotResponse);
        console.log(phone);

        const [rows, fields] = await connection.execute(
          'INSERT INTO preguntasgpt (telefono, pregunta, respuesta) VALUES (?, ?, ?)',
          [phone, userQuestion, chatbotResponse]
        );

        await connection.commit();
        connection.release(); // Libera la conexión después de usarla

        if (!/^salir$/i.test(userQuestion)) {
          await typing(provider, ctx, 4000);
          await fallBack(chatbotResponse);
        } else if (/(^|\s)salir(\s|$)/i.test(userQuestion)) {
          isChatActive = false;
          clearTimeout(warningTimeoutId);
          clearTimeout(endTimeoutId);
          chatGPTInstance.endConversation();
          gotoFlow(flowMenu2);
        }
      } catch (error) {
        //console.error('Error en la función de manejo de chat:', error);
        await flowDynamic('¡Ups! Parece que estamos experimentando algunos problemas en este momento. Por favor, inténtalo de nuevo más tarde. 🙁🤖')
        chatGPTInstance.endConversation();
        gotoFlow(flowMenu2)
        // Puedes tomar medidas adicionales aquí en caso de error, como enviar un mensaje de error al usuario.
      }
    })

//-------------------------------------------------------fin flowPregunta---------------------------------------------------------------

//--------------------------------------------------------flowSemestreB-----------------------------------------------------------------
/**
 * Semester B flow, which queries the database to retrieve all information from the second half of the year. * 
 */
// Function to retrieve data for Semester A schedule.
async function cronogramaB() {
  // Connect to the MySQL database
  const connection = await mysql.createConnection({
    host: MYSQL_DB_HOST,
    user: MYSQL_DB_USER,
    password: MYSQL_DB_PASSWORD,
    database: MYSQL_DB_NAME,
    port: MYSQL_DB_PORT,
  });

  try {
    // Execute an SQL query to retrieve data from the 'cronogramaA' table
    const [rows, fields] = await connection.execute('SELECT * FROM cronogramab');
    return rows;
  } catch (error) {
    console.error(error);
  } finally {
    // Close the connection to the MySQL database
    connection.close();
  }
}

// Variable to track fallBack attempts for flowSemestreB.
let fallBackSemestreB = 0
// Flow for Semester B inquiries.
const flowSemestreB = addKeyword('##_flow_semestre_b_##')
  .addAnswer('Este es el cronograma del Semestre B:')
  .addAction(async (ctx, { flowDynamic }) => {
    const data = await cronogramaB();
    let message = '';
    for (let i = 0; i < data.length; i++) {
      const { Fecha, Actividad, Requisitos } = data[i];
      message += `*Fecha Límite:* ${Fecha}\n*Actividad:* ${Actividad}\n*Requisitos:* ${Requisitos}\n\n`;
    }
    return flowDynamic(message);
  })
  .addAnswer(['Elige una opción: 👇🏼 ', '\n\n*1.* Volver a Cronogramas 📅📋', '*2.* Regresar al Menú 📚📌', '*3.* Finalizar 🏁🤓'], { capture: true }, async (ctx, { fallBack, gotoFlow, endFlow }) => {
    if (ctx.body === '1') {
      gotoFlow(flowInfo);
    }
    else if (ctx.body === '2') {
      gotoFlow(flowMenu2);
    }
    else if (ctx.body === '3') {
      gotoFlow(flowFinal);
    }
    else if (ctx.body !== '1' && ctx.body != '2' && ctx.body != '3') {
      if (fallBackSemestreB < 3) {
        fallBackSemestreB++;
        return fallBack('⚠️ *Selecciona una opcion valida* ⚠️ \n\nIngresa *1* para consultar coronogramas, *2* para volver la menú o *3* para finalizar *BotIS*');
      } else if (fallBackSemestreB === 3) {
        fallBackSemestreB = 0;
        return endFlow({ body: '❌ *Opción no válida* ❌ \n\nChat Bot finalizado, nos vemos luego. 👋🤓' });
      }
    }
  })
//-----------------------------------------------------fin flowSemestreB-----------------------------------------------------------------

//-------------------------------------------------------flowSemestreA-------------------------------------------------------------------
/**
 *Semester A flow, which queries the database to retrieve all information from the second half of the year.
 */
// Function to retrieve data for Semester A schedule.
async function cronogramaA() {
  // Connect to the MySQL database
  const connection = await mysql.createConnection({
    host: MYSQL_DB_HOST,
    user: MYSQL_DB_USER,
    password: MYSQL_DB_PASSWORD,
    database: MYSQL_DB_NAME,
    port: MYSQL_DB_PORT,
  });

  try {
    // Execute an SQL query to retrieve data from the 'cronogramaA' table
    const [rows, fields] = await connection.execute('SELECT * FROM cronogramaA');
    return rows;
  } catch (error) {
    console.error(error);
  } finally {
    // Close the connection to the MySQL database
    connection.close();
  }
}

// Variable to track fallBack attempts for flowSemestreA.
let fallBackSemestreA = 0
// Flow for Semester A inquiries.
const flowSemestreA = addKeyword('##_flow_semestre_a_##')
  .addAnswer('Este es el cronograma del Semestre A:')
  .addAction(async (ctx, { flowDynamic }) => {
    const data = await cronogramaA();
    let message = '';
    for (let i = 0; i < data.length; i++) {
      const { Fecha, Actividad, Requisito } = data[i];
      message += `*Fecha Límite:* ${Fecha}\n*Actividad:* ${Actividad}\n*Requisitos:* ${Requisito}\n\n`;
    }
    return flowDynamic(message);
  })
  .addAnswer(['Elige una opción: 👇', '\n\n*1.* Volver a Cronogramas 📅📋', '*2.* Regresar al Menú 📚📌', '*3.* Finalizar 🏁🤓'], { capture: true }, async (ctx, { fallBack, gotoFlow, endFlow }) => {
    if (ctx.body === '1') {
      console.log('Dentro de opcion 1');
      await gotoFlow(flowInfo);
    }
    else if (ctx.body === '2') {
      gotoFlow(flowMenu2);
    }
    else if (ctx.body === '3') {
      gotoFlow(flowFinal);
    }
    else if (ctx.body !== '1' && ctx.body != '2' && ctx.body != '3') {
      if (fallBackSemestreA < 3) {
        fallBackSemestreA++;
        return fallBack('⚠️ *Selecciona una opcion valida* ⚠️ \n\nIngresa *1* para consultar coronogramas, *2* para volver la menú o *3* para finalizar *BotIS*');
      } else if (fallBackSemestreA === 3) {
        fallBackSemestreA = 0;
        return endFlow({ body: '❌ *Opción no válida* ❌ \n\nChat Bot finalizado, nos vemos luego. 👋🤓' });
      }
    }
  })
//--------------------------------------------------------------fin flowSemestreA---------------------------------------------------------

//-----------------------------------------------------------------flowInfo---------------------------------------------------------------
/**
 * Flow that allows the user to choose the semester they want to inquire about, whether it's semester A or semester B.
 */
// Variable to keep track of fallBack attempts for flowInfo.
let fallBackInfo = 0
// Flow for information retrieval.
const flowInfo = addKeyword('##_flow_info_##')
  .addAnswer(['¿Qué semestre deseas consultar? 🕓📆', '*1.* Semestre *A*', '*2.* Semestre *B*', '*3.* Regresar al menú 📚📌'], { capture: true }, async (ctx, { fallBack, gotoFlow, endFlow }) => {
    if (ctx.body === '1' || ctx.body === 'a') {
      gotoFlow(flowSemestreA);
    }
    else if (ctx.body === '2' || ctx.body === 'b') {
      gotoFlow(flowSemestreB);
    }
    else if (ctx.body === '3') {
      gotoFlow(flowMenu2);
    }
    else if (ctx.body !== '1' && ctx.body != '2' && ctx.body != '3') {
      if (fallBackInfo < 3) {
        fallBackInfo++;
        return fallBack('⚠️ *Selecciona una opcion valida* ⚠️ \n\nIngresa *1* para consultar el semestre A o *2* pra consultar el semestre B');
      } else if (fallBackInfo === 3) {
        fallBackInfo = 0;
        return endFlow({ body: '❌Opción no válida.❌ Chat Bot finalizado, nos vemos luego. 👋🤓' });
      }
    }
  })
//------------------------------------------------------------flowInfo--------------------------------------------------------------------

//----------------------------------------------------flowFechaProgramadasTesis-----------------------------------------------------------
/**
 * Flow that allows the user to inquire about scheduled presentation dates. This flow queries a database.
 */
async function obtenerFila() {
  // Conecta a la base de datos MySQL
  const connection = await mysql.createConnection({
    host: MYSQL_DB_HOST,
    user: MYSQL_DB_USER,
    password: MYSQL_DB_PASSWORD,
    database: MYSQL_DB_NAME,
    port: MYSQL_DB_PORT,
  });

  try {
    // Ejecuta una consulta SQL para obtener los datos de la tabla 'tesisProgramadas'
    const [rows, fields] = await connection.execute('SELECT * FROM fechaprogtesis');
    return rows;
  } catch (error) {
    console.error(error);
  } finally {
    // Cierra la conexión a la base de datos MySQL
    connection.close();
  }
}

let fallbackSustentacion = 0
const flowFechaProgramadasTesis = addKeyword('##_flow_sustentacion_##')
  .addAnswer('Estas son las fechas programadas:')
  .addAction(async (ctx, { flowDynamic }) => {
    const data = await obtenerFila();
    if (!data.length) {
      // Si no se encontraron fechas, envía un mensaje informativo
      return flowDynamic('En este momento no hay fechas de sustentaciones programadas.');
    }
    let message = '';
    for (let i = 0; i < data.length; i++) {
      const { Fecha, Hora, Nombre, Fase, Lugar, Jurados, Expositores, Asesor } = data[i];
      message += `*Fecha:* ${Fecha} \n*Hora:* ${Hora} \n*Proyecto:* ${Nombre} \n*Fase:* ${Fase} \n*Lugar:* ${Lugar} \n*Jurados:* ${Jurados} \n*Expositores:* ${Expositores} \n*Asesor/a:* ${Asesor} \n\n`;
    }
    return flowDynamic(message);
  })
  .addAnswer('Elige una opción: 👇🏼')
  .addAnswer(['*1.* Cronogramas 📅📋', '*2.* Regresar al Menú 📚📌', '*3.* Volver a consultar fechas 🎓🗓️', '*4.* Finalizar 🏁🤓'], { capture: true }, async (ctx, { fallBack, gotoFlow, endFlow }) => {
    if (ctx.body === '1') {
      gotoFlow(flowInfo);
    }
    else if (ctx.body === '2') {
      gotoFlow(flowMenu2);
    }
    else if (ctx.body === '3') {
      gotoFlow(flowFechas);
    }
    else if (ctx.body === '4') {
      gotoFlow(flowFinal);
    }
    else if (ctx.body !== '1' && ctx.body != '2' && ctx.body != '3' && ctx.body != '4') {
      if (fallbackSustentacion < 3) {
        fallbackSustentacion++;
        return fallBack('⚠️ *Selecciona una opcion valida* ⚠️ \n\nIngresa *1* para consultar los cronogramas de los semestres, *2* para volver al menú principal, *3* para volver al menú de fechas o *4* para finalizar *BotIS*');
      } else if (fallbackSustentacion === 3) {
        fallbackSustentacion = 0;
        return endFlow({ body: '❌ *Opción no válida* ❌ \n\nChat Bot finalizado, nos vemos luego. 👋🤓' });
      }
    }
  })
//----------------------------------------------------fin flowFechaProgramadasTesis--------------------------------------------------------

//-----------------------------------------------------------flowFechaGrado----------------------------------------------------------------
/**
 * Flow that allows the user to inquire about scheduled graduation dates. This flow queries a database
 */
async function obtenerGrado() {
  // Conecta a la base de datos MySQL
  const connection = await mysql.createConnection({
    host: MYSQL_DB_HOST,
    user: MYSQL_DB_USER,
    password: MYSQL_DB_PASSWORD,
    database: MYSQL_DB_NAME,
    port: MYSQL_DB_PORT,
  });

  try {
    // Ejecuta una consulta SQL para obtener los datos de la tabla 'tesisProgramadas'
    const [rows, fields] = await connection.execute('SELECT * FROM fechagrado');
    return rows;
  } catch (error) {
    console.error(error);
  } finally {
    // Cierra la conexión a la base de datos MySQL
    connection.close();
  }
}

let fallBackGrado = 0
const flowFechaGrado = addKeyword('##_flow_grado_##')
  .addAnswer('Estas son las fechas de grados:')
  .addAction(async (ctx, { flowDynamic }) => {
    const data = await obtenerGrado();
    if (!data.length) {
      // Si no se encontraron fechas, envía un mensaje informativo
      return flowDynamic('En este momento no hay fechas de grados registradas.');
    }
    let message = '';
    for (let i = 0; i < data.length; i++) {
      const { Fecha, Lugar, Nota } = data[i];
      message += `*Fecha:* ${Fecha} \n*Lugar:* ${Lugar} \n*Último día para socializar:* ${Nota} \n\n`;
    }
    return flowDynamic(message);
  })
  .addAnswer('Elige una opción: 👇🏼')
  .addAnswer(['*1.* Cronogramas 📅📋', '*2.* Regresar al Menú 📚📌', '*3.* Volver a consultar fechas 🎓🗓️', '*4.* Finalizar 🏁🤓'], { capture: true }, async (ctx, { fallBack, gotoFlow, endFlow }) => {
    if (ctx.body === '1') {
      gotoFlow(flowInfo);
    }
    else if (ctx.body === '2') {
      gotoFlow(flowMenu2);
    }
    else if (ctx.body === '3') {
      gotoFlow(flowFechas);
    }
    else if (ctx.body === '4') {
      gotoFlow(flowFinal);
    }
    else if (ctx.body !== '1' && ctx.body != '2' && ctx.body != '3' && ctx.body != '4') {
      if (fallBackGrado < 3) {
        fallBackGrado++;
        return fallBack('⚠️ *Selecciona una opcion valida* ⚠️ \n\nIngresa *1* para consultar los cronogramas de los semestres, *2* para volver al menú principal, *3* para volver al menú de fechas o *4* para finalizar *BotIS*');
      } else if (fallBackGrado === 3) {
        fallBackGrado = 0;
        return endFlow({ body: '❌ *Opción no válida* ❌ \n\nChat Bot finalizado, nos vemos luego. 👋🤓' });
      }
    }
  })
//------------------------------------------------------fin flowFechaGrado-----------------------------------------------------------------

//--------------------------------------------------------flowFechas-----------------------------------------------------------------------
/**
 * Flow that allows the user to choose between options to inquire about graduation dates or presentation dates and also allows ending BotIS
 */
let fallbackFechas = 0
const flowFechas = addKeyword('##_flow_fechas_##')
  .addAnswer('Aquí podrá consultar las fechas de *grados* o de *sustentaciones* programadas. 🎓🗓️')
  .addAnswer(['*1.* Grados 📆🎓', '*2.* Sustentación 📝📑', '*3.* Regresar al Menú 📚📌', '*4.* Finalizar 🏁🤓'], { capture: true }, async (ctx, { fallBack, gotoFlow, endFlow }) => {
    if (ctx.body === '1') {
      gotoFlow(flowFechaGrado);
    }
    else if (ctx.body === '2') {
      gotoFlow(flowFechaProgramadasTesis);
    }
    else if (ctx.body === '3') {
      gotoFlow(flowMenu2);
    }
    else if (ctx.body === '4') {
      gotoFlow(flowFinal);
    }
    else if (ctx.body !== '1' && ctx.body != '2' && ctx.body != '3') {
      if (fallbackFechas < 3) {
        fallbackFechas++;
        return fallBack('⚠️ *Selecciona una opcion valida* ⚠️ \n\nIngresa *1* para consultar fechas de grados, *2* para consultar fechas de sustentaciones, *3* para volver la menú principal o *4* para finalizar *BotIS*');
      } else if (fallbackFechas === 3) {
        fallbackFechas = 0;
        return endFlow({ body: '❌ *Opción no válida* ❌ \n\nChat Bot finalizado, nos vemos luego. 👋🤓' });
      }
    }
  })
//---------------------------------------------------------------fin flowFechas------------------------------------------------------------

//-----------------------------------------------------------------flowMenu2---------------------------------------------------------------
/**
 * Flow of a second menu which does not have the welcome message in comparison to the main menu flow
 */
// Variable to track fallBack attempts for flowMenu2.
let fallbackMenu2 = 0
// Main menu2 flow.
const flowMenu2 = addKeyword('##_flow_menu_2_##')
  .addAnswer('Selecciona la opción que más sea de tu interes ingresando el número correspondiente: 🔢👇')
  .addAnswer(['*Menú principal* 📚📌,\n\n*1.* Preguntas sobre el proceso investigativo 🤔❓', '*2.* Consultar las fechas de sustentaciones o grados 🎓🗓️', '*3.* Cronogramas 📅📋', '*4.* Finalizar 🏁🤓'], { capture: true }, async (ctx, { fallBack, gotoFlow, endFlow }) => {
    if (ctx.body === '1') {
      gotoFlow(flowPregunta);
    }
    else if (ctx.body === '2') {
      gotoFlow(flowFechas);
    }
    else if (ctx.body === '4') {
      gotoFlow(flowFinal);
    }
    else if (ctx.body === '3') {
      gotoFlow(flowInfo)
    }
    else if (ctx.body !== '1' && ctx.body != '2' && ctx.body != '3' && ctx.body != '4') {
      if (fallbackMenu2 < 3) {
        fallbackMenu2++;
        return fallBack('⚠️ *Selecciona una opcion valida* ⚠️ \n\nIngresa *1* Para preguntas a la IA sobre el proceso investigativo, *2* para consultar fechas de grados o sustentacion, *3* para consultar cronogramas de los semestres o *4* para finalizar *BotIS*');
      } else if (fallbackMenu2 === 3) {
        fallbackMenu2 = 0;
        return endFlow({ body: '❌ *Opción no válida* ❌ \n\nChat Bot finalizado, nos vemos luego. 👋🤓' });
      }
    }
  })

//---------------------------------------------------fin flowMenu2------------------------------------------------------------------------

//------------------------------------------------------flowMenu--------------------------------------------------------------------------
/**
 * Main menu flow that displays the options offered by BotIS
 */
// Variable to track fallBack attempts for flowMenu.
let fallbackMenu = 0
// Main menu flow.
const flowMenu = addKeyword(EVENTS.ACTION)
  .addAnswer('🤓 *Bienvenido* 🤓 \n\nSelecciona la opción que más sea de tu interes ingresando el número correspondiente: 🔢👇')
  .addAnswer(['*Menú principal* 📚📌,\n\n*1.* Preguntas sobre el proceso investigativo 🤔❓', '*2.* Consultar las fechas de sustentaciones o grados 🎓🗓️', '*3.* Cronogramas 📅📋', '*4.* Finalizar 🏁🤓'], { capture: true }, async (ctx, { fallBack, gotoFlow, endFlow }) => {
    if (ctx.body === '1') {
      gotoFlow(flowPregunta);
    }
    else if (ctx.body === '2') {
      gotoFlow(flowFechas);
    }
    else if (ctx.body === '4') {
      gotoFlow(flowFinal);
    }
    else if (ctx.body === '3') {
      gotoFlow(flowInfo)
    }
    else if (ctx.body !== '1' && ctx.body != '2' && ctx.body != '3' && ctx.body != '4') {
      if (fallbackMenu < 3) {
        fallbackMenu++;
        return fallBack('⚠️ *Selecciona una opcion valida* ⚠️ \n\nIngresa *1* Para preguntas a la IA sobre el proceso investigativo, *2* para consultar fechas de grados o sustentacion, *3* para consultar cronogramas de los semestres o *4* para finalizar *BotIS*');
      } else if (fallbackMenu === 3) {
        fallbackMenu = 0;
        return endFlow({ body: '❌ *Opción no válida* ❌ \n\nChat Bot finalizado, nos vemos luego. 👋🤓' });
      }
    }
  })
//------------------------------------------------------fin flowMenu--------------------------------------------------------------------

//------------------------------------------------------flowPrincipal-------------------------------------------------------------------
/**
 * The main flow of the chatbot, which starts when the user types any word and makes a database query when the user enters an email address.
 * The user must be a Systems Engineering student at Universidad Mariana.
 * @param {*} correo 
 */

// Function to validate an email address
async function validarCorreo(correo) {
  // Database connection
  const connection = await mysql.createConnection({
    host: MYSQL_DB_HOST,
    user: MYSQL_DB_USER,
    password: MYSQL_DB_PASSWORD,
    database: MYSQL_DB_NAME,
    port: MYSQL_DB_PORT
  });

  try {
    // Execute the query
    const query = `SELECT correo FROM correo WHERE correo = '${correo}'`;
    const [rows, fields] = await connection.query(query);

    // Process the results
    const correosValidos = rows.map(row => row.correo);


    return correosValidos;

  } catch (error) {
    console.error(error);
    throw new Error('Error al obtener los correos válidos');
  } finally {
    // Close the database connection
    connection.end();
  }
}


let fallBackCount = 0;
let correo;
// Main chatbot flow
const flowPrincipal = addKeyword(EVENTS.WELCOME)
  .addAnswer('👋 ¡Hola! Soy *BotIS* 🤖')
  .addAnswer('Soy tu asistente para la investigación en *Ingeniería de Sistemas* en la *Universidad Mariana* 🎓. Estoy aquí para ayudarte en todo. \n\n*¡Vamos a hacer que tu investigación sea un éxito!* 💪📚🔍')
  .addAnswer('¿Cuál es tu correo institucional? 📧🧐', { capture: true }, async (ctx, { fallBack, endFlow, gotoFlow }) => {
    try {
      correo = ctx.body.toLowerCase();
      const correosValidos = await validarCorreo(correo);
      if (correosValidos.includes(correo)) {
        console.log('Correo válido:', ctx.body);
        gotoFlow(flowMenu);

      } else {
        throw new Error('Correo inválido');
      }
    } catch (error) {
      console.error(error);
      // Sending a notification if fallBack is returned 3 times
      fallBackCount++;
      if (fallBackCount === 3) {
        // Code for sending the notification
        fallBackCount = 0;
        return endFlow({ body: '❌ *Correo no Valido* ❌ \n\nChat Bot finalizado, nos vemos luego. 👋🤓' });
      } else {
        fallBack('⚠️ *Correo no encontrado* ⚠️ \n\nSe requiere que el usuario sea estudiante o docente de Ingeniería de Sistemas de la Universidad Mariana y que inicie sesión utilizando su correo institucional. Vuelve a intentarlo!!');
      }
    }
  })
//-------------------------------------------fin flowPrincipal---------------------------------------------------------------------------------



// Import required modules and libraries.
const main = async () => {
  const adapterDB = new MockAdapter()// Create a MockAdapter for database operations.  
  const adapterFlow = createFlow([flowPrincipal, flowMenu, flowInfo, flowSemestreA, flowSemestreB, flowMenu2, flowFechas, flowFechaGrado,
    flowFechaProgramadasTesis, flowFinal, flowPregunta])// Create a flow by combining multiple flow functions.  
  const adapterProvider = createProvider(BaileysProvider)// Create a provider using BaileysProvider for WhatsApp functionality.

  // Create a WhatsApp bot with the specified flow, provider, and database.
  createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  })


  const botName = 'BotIS'// Define the bot's name as 'BotIS'.  
  QRPortalWeb({ port: 3005 })// Initialize the QR code portal for the bot on port 3005.
  //})

}

// Call the main function to start the bot.
main()