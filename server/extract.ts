import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

const extractionSchema = {
  name: "extracted_customer_info",
  schema: {
    type: "object",
    properties: {
      firstName: { type: "string", description: "Customer first name" },
      lastName: { type: "string", description: "Customer last name" },
      phone: { type: "string", description: "Phone number" },
      email: { type: "string", description: "Email address" },
      company: { type: "string", description: "Company or business name" },
      address: {
        type: "object",
        properties: {
          street: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          zip: { type: "string" },
        },
        required: ["street", "city", "state", "zip"],
      },
      vehicles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            year: { type: "string" },
            make: { type: "string" },
            model: { type: "string" },
            color: { type: "string" },
            vin: { type: "string" },
            licensePlate: { type: "string" },
          },
          required: ["year", "make", "model", "color", "vin", "licensePlate"],
        },
      },
    },
    required: ["firstName", "lastName", "phone", "email", "company", "address", "vehicles"],
  },
  strict: false,
};

export const extractRouter = router({
  fromMessages: publicProcedure
    .input(
      z.object({
        messages: z.array(z.string()),
        existingName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const messageText = input.messages.join("\n---\n");

      const systemPrompt = `You are a data extraction assistant. Analyze the following SMS/text message conversation and extract any customer information you can find. Look for:
- Names (first and last)
- Phone numbers
- Email addresses
- Physical addresses (street, city, state, zip)
- Vehicle information (year, make, model, color, VIN, license plate)
- Company or business names

Return ONLY information that is explicitly mentioned or strongly implied in the messages. Use empty strings for fields where no information is found. For vehicles, only include entries where at least a make or model is mentioned.

${input.existingName ? `The customer's known name is: ${input.existingName}` : ""}`;

      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here are the messages to analyze:\n\n${messageText}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: extractionSchema,
        },
      });

      const content = result.choices?.[0]?.message?.content;
      const text = typeof content === "string" ? content : "";

      try {
        return JSON.parse(text);
      } catch {
        return {
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          company: "",
          address: { street: "", city: "", state: "", zip: "" },
          vehicles: [],
        };
      }
    }),
});
