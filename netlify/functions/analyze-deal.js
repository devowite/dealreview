// This code runs on a secure server, not in the browser!
const fetch = require('node-fetch');

exports.handler = async function (event, context) {
    // Get the prompt data from the incoming request from your front-end
    const { promptForAI } = JSON.parse(event.body);
    
    // Get the secret API key from an environment variable
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`, // The key is securely added here
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{ "role": "user", "content": promptForAI }],
                temperature: 0.5,
            }),
        });

        if (!response.ok) {
            // If OpenAI returns an error, pass it back
            const errorData = await response.json();
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: errorData.error.message }),
            };
        }

        const result = await response.json();

        // Send the successful response back to the front-end
        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal error occurred.' }),
        };
    }
};
