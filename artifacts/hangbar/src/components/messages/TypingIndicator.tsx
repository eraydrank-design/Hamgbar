/**
 * Animated "..." typing indicator shown below the chat when the other
 * user is composing a message.
 */
export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-1 px-1">
      <div className="bg-white/10 border border-white/5 rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.9s' }}
          />
        ))}
      </div>
    </div>
  );
}
