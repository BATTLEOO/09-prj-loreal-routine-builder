export default {
  async fetch(request, env, ctx) {
    // These headers let the browser call the worker from the frontend.
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle the browser's preflight request.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Only allow POST requests for chat messages.
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Use POST to send messages to this worker." }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    try {
      // Read the JSON body that the frontend sends.
      const body = await request.json();
      const messages = Array.isArray(body?.messages) ? body.messages : null;
      const selectedProducts = Array.isArray(body?.selectedProducts)
        ? body.selectedProducts
        : [];

      if (!messages || messages.length === 0) {
        return new Response(
          JSON.stringify({ error: "A messages array is required." }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      // This system message tells OpenAI how to behave.
      const systemMessage = {
        role: "system",
        content:
          "You are a friendly L'Oréal routine advisor. Help the user build a practical skincare, haircare, or makeup routine using the products they selected. Use the conversation history to answer follow-up questions. Keep the response clear, helpful, and easy to understand. If the user gives selected products, base the routine on those products first.",
      };

      const selectedProductsMessage =
        selectedProducts.length > 0
          ? {
              role: "system",
              content: `Selected products chosen by the user:\n${selectedProducts
                .map(
                  (product) =>
                    `- ${product.brand} - ${product.name}: ${product.description}`,
                )
                .join("\n")}`,
            }
          : null;

      // Add the system prompt before the user's conversation history.
      const normalizedMessages = [
        systemMessage,
        ...(selectedProductsMessage ? [selectedProductsMessage] : []),
        ...messages.map((message) => ({
          role: message.role,
          content: String(message.content ?? ""),
        })),
      ];

      // Send the conversation to OpenAI through the Worker secret.
      const openAIResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1",
            messages: normalizedMessages,
            temperature: 0.7,
          }),
        },
      );

      if (!openAIResponse.ok) {
        const errorText = await openAIResponse.text();
        return new Response(
          JSON.stringify({
            error: "OpenAI request failed.",
            details: errorText,
          }),
          {
            status: 502,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      // Return the assistant reply in the same shape the frontend expects.
      const data = await openAIResponse.json();
      const reply =
        data?.choices?.[0]?.message?.content ??
        "I could not generate a routine just now.";

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: reply,
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Worker error.",
          details: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
  },
};
