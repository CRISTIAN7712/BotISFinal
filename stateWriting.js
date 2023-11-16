/**
 * Function to simulate typing in a chat for a specified period of time.
 *
 * @param {Object} provider - Messaging provider used to send presence updates.
 * @param {Object} ctx - Chat context containing relevant information.
 * @param {number} ms - Time in milliseconds for which typing is simulated.
 * @returns {Promise} - A promise that resolves after the simulation is complete.
 */
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const typing = async (provider, ctx, ms) => {
    // Get an instance of the messaging provider.
    const refProvider = await provider.getInstance();
    // Get the remote chat identifier.
    const jid = ctx.key.remoteJid;

    // Wait for 300 milliseconds before sending a "composing" presence update.
    await delay(300);
    await refProvider.sendPresenceUpdate("composing", jid);

    // Wait for the specified time (ms) to simulate typing.
    await delay(ms);

    // After the simulation is complete, send an "available" presence update.
    await refProvider.sendPresenceUpdate("available", jid);
};

// Export the 'typing' function so it's available for use in other modules.
module.exports = { typing };