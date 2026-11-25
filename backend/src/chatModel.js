import { chat as claudeChat, claudeEnabled, CHAT_MODEL, ChatUnavailableError } from './claude.js';

const WORKERS_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const INFERENCE_TIMEOUT_MS = 8_000;

export function createChatModel(env) {
  if (claudeEnabled()) return { model: CHAT_MODEL, chat: claudeChat };
  if (!env.AI || env.WORKERS_AI_ENABLED === 'false') return null;

  return {
    model: WORKERS_AI_MODEL,
    async chat(system, messages) {
      let timeout;
      try {
        const result = await Promise.race([
          env.AI.run(WORKERS_AI_MODEL, {
            messages: [{ role: 'system', content: system }, ...messages],
            max_completion_tokens: 400,
            temperature: 0.2,
            chat_template_kwargs: { enable_thinking: false },
          }),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('inference timeout')), INFERENCE_TIMEOUT_MS);
          }),
        ]);
        const choice = result?.choices?.[0];
        const text = choice?.message?.content ?? result?.response;
        if (choice?.finish_reason === 'length' || typeof text !== 'string' || !text.trim()) {
          throw new Error('incomplete model response');
        }
        return text.trim();
      } catch {
        throw new ChatUnavailableError('api_error', 'Workers AI inference unavailable');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
