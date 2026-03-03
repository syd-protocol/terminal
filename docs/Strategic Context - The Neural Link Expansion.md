# Post Stge 4: Strategic Context: The Solar System Quest Architecture
Status: Post-Stage 4 Development (Expansion Layer)

Core Concept: A triple-layered content system that maps the player's life across different scales of time, powered by a modular AI "Processor Upgrade."

1. The Three Layers (The Solar System)
The System manages three distinct frequencies of gameplay. It functions perfectly with just one layer, but provides maximum "Luck" acceleration when all three are active.

I. Daily Directives (Planets): The foundational habits from quests.json. Steady, predictable stat-building.

II. System Incursions (Meteors): Time-sensitive "Bounty Quests" generated from today’s specific real-world plans. High-reward tactical play.

III. World Bosses (Stars): Massive, long-term goals (e.g., "Write a Book"). These have persistent HP bars and are "damaged" by completing relevant Dailies and Incursions.

2. System Processor Upgrade (The AI Layer)
To enable the translation of real-world plans into Incursions and World Bosses, the player performs a "Processor Upgrade":

The BYO-Key Model: Users provide their own LLM API key (stored locally). This grants the System "Neural Interpretation" without server-side costs or privacy risks.

Neural Translation: The AI acts as a real-time bridge, turning raw plan text (e.g., "Big presentation at 2 PM") into game entities (e.g., [BOSS ENCOUNTER: THE ARBITER]) before purging the input to maintain the Ephemeral Protocol.

3. Dynamic UX & Flow
The UI is "Elastic"—it expands or collapses based on the player's active layers:

Solo Flow: Zen-like habit dashboard focusing on Dailies.

Combat Flow: Adds an urgent [ TEMPORAL BREACH ] section for Incursions.

War Room Flow: An epic scale featuring the looming World Boss HP bar.

4. Future Thought: Co-op Synchronization
As a secondary expansion, the System may eventually allow for Co-op Raids. This would allow players facing the same World Boss (e.g., a shared project) to sync their progress. To stay lean, this would likely use a technically simple method like "Sync Codes" or a peer-to-peer database link (similar to Brave's sync), ensuring social accountability without the weight of a traditional social network.