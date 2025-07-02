# The OopisOS Text Adventure Engine

- [The OopisOS Text Adventure Engine](#the-oopisos-text-adventure-engine)
      + [1. How to Play](#1-how-to-play)
      + [2. The Anatomy of an Adventure](#2-the-anatomy-of-an-adventure)
         - [**Rooms**](#rooms)
         - [**Items**](#items)
         - [**Stateful & Interactive Items**](#stateful--interactive-items)
         - [**NPCs (Non-Player Characters)**](#npcs-non-player-characters)
         - [**Daemons (Timed Events)**](#daemons-timed-events)
         - [**Win Conditions**](#win-conditions)
      + [3. Creating Your First Adventure](#3-creating-your-first-adventure)
- [Architect's Apprentice - Beta Test Walkthrough](#architects-apprentice---beta-test-walkthrough)
      + [Step 1: Getting Started](#step-1-getting-started)
      + [Step 2: Finding the Key](#step-2-finding-the-key)
      + [Step 3: Unlocking the Chest & Finding the Page](#step-3-unlocking-the-chest--finding-the-page)
      + [Step 4: Powering the Terminal](#step-4-powering-the-terminal)
      + [Step 5: Compiling the Room (Winning the Game)](#step-5-compiling-the-room-winning-the-game)

Welcome, Architect. This document is your guide to the OopisOS Text Adventure Engine, a powerful tool for creating and playing interactive fiction directly within the operating system. Whether you want to play the built-in game or build your own world from scratch, this manual will show you how.

### 1. How to Play

Getting started is simple. Just type `adventure` into the terminal to launch the default story, "The Architect's Apprentice."

```
> adventure
```

This will open the game in a full-screen modal. To exit the game and return to the terminal at any time, type `quit`. For a full list of in-game commands, type `help`.

You can also load custom adventures created by other users (or yourself!) by providing the path to a valid adventure file.

```
> adventure /path/to/my_game.json
```

### 2. The Anatomy of an Adventure

Every adventure is a world defined by a single `.json` file. This file contains all the rooms, items, characters, and logic that make up the game. The engine is designed to be data-driven, meaning you don't need to write any code to create a complex adventure; you just need to describe your world in the JSON format.

Let's break down the main components using examples from the default adventure.

#### **Rooms**

Rooms are the fundamental building blocks of your world. Each room is an object with a unique ID.

```
"test_chamber": {
    "name": "Test Chamber",
    "description": "You are in a room that feels... unfinished...",
    "exits": { "north": "server_closet" },
    "onListen": "You hear a low, persistent hum.",
    "points": 5
}
```

- `name`: The title of the room, displayed in the status bar.
    
- `description`: The main text shown to the player when they enter or `look`.
    
- `exits`: An object mapping directions (or custom exit names) to the ID of another room.
    
- `isDark`: (boolean) If `true`, the room's description will be hidden unless the player has a lit `isLightSource` item.
    
- `onListen` / `onSmell` / `onTouch`: Custom text that is displayed when the player uses a sensory verb (`listen`, `smell`, `touch`) in the room without a specific target.
    
- `points`: The number of points awarded to the player for visiting the room for the first time.
    

#### **Items**

Items are the objects that populate your world. They can be taken, used, and interacted with in various ways.

```
"key": {
    "id": "key",
    "name": "brass key",
    "noun": "key",
    "adjectives": ["brass", "small"],
    "description": "A small, plain brass key.",
    "location": "test_chamber",
    "canTake": true,
    "unlocks": "chest",
    "points": 10
}
```

- `id`: A unique identifier for the item.
    
- `name`: The full name of the item (e.g., "brass key").
    
- `noun`: The primary noun for the parser (e.g., "key").
    
- `adjectives`: An array of adjectives to help the parser disambiguate (e.g., `take brass key` vs. `take iron key`).
    
- `description`: The text shown when the player `look`s at the item.
    
- `location`: The ID of the room, NPC, or container item where the item starts. Can also be `"player"` for starting inventory.
    
- `canTake`: (boolean) Determines if the player can pick up the item.
    
- `unlocks`: The `id` of an item this item can unlock. Used with the `unlock [item] with [key]` command.
    
- `points`: Score awarded for taking the item for the first time.
    

#### **Stateful & Interactive Items**

Items can be much more than static objects. They can have states, contain other items, and react to player actions.

**Containers:** To make an item a container, add these properties:

- `isContainer`: `true`
    
- `isOpenable`: `true`
    
- `isOpen`: `false` (initial state)
    
- `isLocked`: `true` (optional)
    
- `contains`: An array of item IDs that are inside.
    

**State-Dependent Descriptions:** An item's description can change based on its `state` property. This is perfect for things that can be turned on or off.

```
"terminal": {
    "id": "terminal",
    "name": "computer terminal",
    "location": "test_chamber",
    "state": "off",
    "descriptions": {
        "off": "A computer terminal with a blank, dark screen.",
        "on": "The terminal screen glows with a soft green light..."
    }
}
```

**Complex Interactions (`onPush`, `onUse`):** You can define what happens when a player `push`es, `pull`s, or `turn`s an item. This can change the item's own state and even affect other items in the world.

```
"power_box": {
    "id": "power_box",
    "state": "off",
    "onPush": {
        "newState": "on",
        "message": "You push the heavy lever. It clunks into the 'ON' position.",
        "effects": [
            { "targetId": "terminal", "newState": "on" }
        ]
    }
}
```

The `use [item] on [target]` command allows for even more specific puzzles.

```
"terminal": {
    // ...
    "onUse": {
        "page": {
            "conditions": [
                { "itemId": "terminal", "requiredState": "on" }
            ],
            "failureMessage": "You touch the page to the dark screen, but nothing happens.",
            "destroyItem": true
        }
    }
}
```

- `onUse`: An object where keys are the `id` of the item being used.
    
- `conditions`: An array of requirements that must be met for the action to succeed.
    
- `failureMessage`: The message shown if conditions are not met.
    
- `destroyItem`: If `true`, the item used (e.g., the page) is removed from the player's inventory.
    

#### **NPCs (Non-Player Characters)**

You can add characters to your world for the player to interact with.

```
"architect": {
    "id": "architect",
    "name": "The Architect",
    "noun": "architect",
    "location": "test_chamber",
    "dialogue": {
        "default": "'Welcome, apprentice,' the holographic figure says.",
        "terminal": "'The terminal is the key to compiling the environment...'"
    },
    "onShow": {
        "page": "The Architect's form stabilizes... 'Excellent! Now, use the page...'",
        "default": "The Architect glances at the item but doesn't react."
    }
}
```

- `dialogue`: An object mapping keywords to responses. The player triggers these with `ask [npc] about [keyword]`. A `default` response is used for `talk to [npc]` or if no keyword matches.
    
- `onShow`: Defines how an NPC reacts when the player uses `show [item] to [npc]`.
    

#### **Daemons (Timed Events)**

Daemons are background processes that can trigger events based on game turns. This is useful for providing hints or creating time-sensitive events.

```
"hint_daemon": {
    "active": true,
    "repeatable": true,
    "trigger": {
        "type": "every_x_turns",
        "value": 10
    },
    "action": {
        "type": "message",
        "text": "The Architect looks at you thoughtfully..."
    }
}
```

- `trigger.type`: Can be `every_x_turns` or `on_turn` (for a specific move number).
    
- `action.type`: Currently supports `message`, which displays text to the player.
    

#### **Win Conditions**

You define how the game is won in the root of the JSON file.

```
"winCondition": {
    "type": "itemUsedOn",
    "itemId": "page",
    "targetId": "terminal"
},
"winMessage": "You have won!"
```

- `type`: Can be `itemInRoom` (player must drop a specific item in a specific room), `playerHasItem` (player must simply acquire an item), or `itemUsedOn` (player must use one item on another).
    

### 3. Creating Your First Adventure

1. **Create a JSON File:** Create a new file named `my_adventure.json` using `touch` or `edit`.
    
2. **Define the World:** Start with the basic structure: a title, starting room, and a win condition.
    
3. **Build the Rooms:** Create at least two room objects inside the `rooms` section. Give them names, descriptions, and link them with `exits`.
    
4. **Add Items:** Populate your rooms with items. Create a key and a locked object, or a simple item the player needs to find.
    
5. **Upload the File:** Use the `upload` command to add your `.json` file to the virtual file system.
    
6. **Play!** Launch your adventure with `adventure my_adventure.json`.
    

The OopisOS Text Adventure Engine provides a flexible and powerful framework for interactive storytelling. Now go, and build something extraordinary.
# Architect's Apprentice - Beta Test Walkthrough

**Objective:** This document provides a step-by-step guide to completing the default text adventure, "The Architect's Apprentice." Its purpose is to allow beta testers to verify the game's core logic, puzzle progression, and feature implementation.

### Step 1: Getting Started

You begin in the `Test Chamber`. The first thing you should do is get your bearings and understand your objective.

1. **Talk to the Architect** to learn about your primary goal.
    
    ```
    > talk to architect
    ```
    
2. **Examine the room** to identify key objects.
    
    ```
    > look
    ```
    
    You will see a desk, a chest, a terminal, and the Architect.
    

### Step 2: Finding the Key

The chest is locked, so you'll need to find a key.

1. **Look at the desk** more closely.
    
    ```
    > look at desk
    ```
    
2. You'll see a key on the desk. **Take it**.
    
    ```
    > take key
    ```
    
    _Pronoun Test:_ The Architect may prompt you to "take it." You can test the pronoun resolution by typing: `> take it`
    

### Step 3: Unlocking the Chest & Finding the Page

Now you can open the chest to find the main quest item.

1. **Unlock the chest** using the key you just found.
    
    ```
    > unlock chest with key
    ```
    
2. **Open the chest**.
    
    ```
    > open chest
    ```
    
3. **Take the manual page** from inside the chest.
    
    ```
    > take page
    ```
    
4. **Read the page** to understand its purpose. It mentions needing to power up the terminal.
    
    ```
    > read page
    ```
    

### Step 4: Powering the Terminal

The terminal is off. You need to find the power source.

1. **Ask the Architect about the terminal** for a hint.
    
    ```
    > ask architect about terminal
    ```
    
2. He'll mention it's without power. The only other exit is north. **Go north** into the server closet.
    
    ```
    > go north
    ```
    
3. The closet is dark. You'll need a light source. **Take the lantern**.
    
    ```
    > take lantern
    ```
    
4. **Light the lantern**.
    
    ```
    > light lantern
    ```
    
5. With the room now lit, **look around** to find the power box.
    
    ```
    > look
    ```
    
6. **Push the lever** on the power box to turn it on.
    
    ```
    > push lever
    ```
    
    You will receive a message that the terminal in the other room is now powered on.
    

### Step 5: Compiling the Room (Winning the Game)

You have the manual page and the terminal is powered on. It's time to finish the test.

1. **Go south** to return to the main chamber.
    
    ```
    > go south
    ```
    
2. **Look at the terminal** to confirm it is now on.
    
    ```
    > look at terminal
    ```
    
3. **Use the manual page on the terminal** to complete the objective and win the game.
    
    ```
    > use page on terminal
    ```
    

If you've followed these steps, the game should conclude with the win message. Please report any deviations, errors, or unexpected behavior. Thank you for your help in testing!