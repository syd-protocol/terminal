# Strategic Context: The Co-op "Sync-Link" Protocol

**Status:** Post-Stage 5 Development (Social Layer)

**Core Concept:** A "Zero-Auth" asynchronous co-op mode where survivors synchronize terminals to maximize Luck and tackle shared real-world objectives.

## 1. The Vision: "Shared Frequency"

Co-op is framed as **Tactical Synchronization**. It moves the game from a solitary survival experience to a **Resistance Cell** model. Players don't just "chat"; they tether their progress to deal collective damage to "Goliaths" (World Bosses) and survive "Temporal Rifts."

* **The Goal:** To provide a **Social Luck Multiplier**. Collaboration is the fastest way to level up.
* **The Vibe:** Encrypted, high-stakes coordination across a digital wasteland.

---

## 2. Encounter Types & Real-World Mapping

| System Entity | Real-World Equivalent | Duration |
| --- | --- | --- |
| **World Boss Raid** | Large-scale projects (App Launch, Marathon, Certification). | Weeks / Months |
| **Temporal Rift** | Time-bound, high-stress events (Meetings, Sprints, Exams). | 1 – 4 Hours |

---

## 3. Technical Architecture: "The Lean Sync"

To maintain our "No-Account" philosophy, the system uses an anonymous handshake protocol.

* **Database:** A single-table `sync_instances` (Firebase/Supabase).
* **The Handshake:** A 5-character alphanumeric **Sync-ID** (e.g., `TR-88`). No email/password required; players are identified by local `UUID`.
* **Sync Logic:** Asynchronous polling. Apps fetch the shared JSON "Session Blob" (Boss HP, Ally Status) every 30–60 seconds, creating an atmospheric "Satellite Delay."

---

## 4. The "SOS Frequency" (Public Bulletin Board)

A future discovery layer where the terminal acts as a global radio receiver for players seeking aid.

* **Public Broadcast:** Hosts can toggle an encounter to "Public," listing it on the global **Bulletin Board**.
* **Luck Farming:** High-level players can browse the feed to join Rifts, helping others while earning massive Luck bonuses.

---

## 5. Tactical Comms: Telegram Topics

To facilitate human coordination without the bloat of an internal chat system, the app "patches" players into external channels.

* **The Resistance Hub:** A central Telegram Supergroup serves as the primary comms server.
* **Disposable Threads:** Using the Telegram API (`createForumTopic`), the system generates a **Mission Topic** for every Raid.
* **Deep-Linking:** The `[ ESTABLISH COMMS ]` button uses the `tg://` protocol to force-open the Telegram app directly into the specific mission thread.
* **Persistence:** The connection remains after the boss is defeated, allowing survivors to maintain their real-world networking.

---

## 6. Design & UX Feedback

* **The Sync Pulse:** When tethered to an ally, the ambient audio drone gains a secondary "heartbeat" rhythm.
* **System Logs:** The terminal prints anonymous ally activity (e.g., `[SYNC] OPERATOR_02: CRITICAL HIT DEALT`).
* **Resonance State:** If both players complete tasks within the same hour, the system triggers **[RESONANCE]**, doubling all XP and Luck gains.

---

### Summary of Strategic Intent

This protocol fulfills the player's core job: **"How can I level up quick?"** By introducing the **Sync-Link**, we turn social accountability into a gameplay mechanic, rewarding real-world partnership with the highest growth multipliers in the System.