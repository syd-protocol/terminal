# Stage 3 Supplement - Interface and Sensory Immersion

Copying a few learnings from Terminal-based Survival Sims, the goal is to see how we might make the UI feel more alive like a "living transmission" from the System, emphasizing physicality, agency, and atmosphere without cluttering the minimalist codebase and increasing immersion in a 1-D space.

1. Atmospheric Foundation (The Drone)
To create the "Survival Sim" tension, the System shouldn't be silent.

 - Ambient Oscillator: A continuous, low-frequency sine wave (~55Hz) will play at low gain (~0.04) while the Quest or Status screens are active. What do you think? It shouldn't irritate, but immerse the user.
 - Dynamic Response: The drone's pitch or "jitter" should subtly shift when the player is in a Corrupted state (HP < 25), signaling structural instability in the connection.

2. The Boot Sequence (Physicality of Connection)
The app should feel like it is "initialising" a remote link every time it is opened.

 - Recursive Check: Upon relaunch or launch, a rapid 1-second monospace text scroll (something like > ANALYSING TEMPORAL BUFFER... [OK]) appears before the main UI fades in.
 - The Signal: We already have this in the onboarding with a "Signal Detected" lore sequence, forcing the player to "Initialise" their identity as a survivor rather than just a user.

3. Command-Line Feedback (The System Log)
To simulate a terminal without congesting the UI, we could implement a Transient Notification Log:

 - Action Echo: Every user action (completing a quest, buying an item) triggers a small, monospace "log entry" that slides into a dedicated corner or bottom-bar and fades after 3 seconds.
 - Format: We could use the --accent color and terminal syntax: [LOG: STRENGTH +3], [LOG: ENTROPY -10], or [LOG: GEAR_SHIFT_SUCCESS].
 - The Bridge: When an item is consumed, the log echoes the real-world act (e.g., [SYSTEM_REGISTERED: VITALITY_TONIC_CONSUMED]), reinforcing the indirect prompt philosophy.