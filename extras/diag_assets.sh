# diag_assets.sh - Creates files needed for the diagnostic suite.

echo "--- Creating assets for interactive prompt tests ---"
# For rm -i, cp -i, mv -i
echo "This file will be interactively deleted." > interactive_file.txt
echo "SOURCE" > interactive_source.txt
echo "TARGET" > interactive_target.txt
echo "SOURCE 2" > mv_source_2.txt
echo "TARGET 2" > mv_target_2.txt

# Create the test scripts for rm, cp, mv
echo 'rm -i interactive_file.txt' > test_rm_no.sh; echo 'no' >> test_rm_no.sh; chmod 700 test_rm_no.sh
echo 'rm -i interactive_file.txt' > test_rm_yes.sh; echo 'YES' >> test_rm_yes.sh; chmod 700 test_rm_yes.sh
echo 'cp -i interactive_source.txt interactive_target.txt' > test_cp_no.sh; echo 'n' >> test_cp_no.sh; chmod 700 test_cp_no.sh
echo 'cp -i interactive_source.txt interactive_target.txt' > test_cp_yes.sh; echo 'YES' >> test_cp_yes.sh; chmod 700 test_cp_yes.sh
echo 'mv -i mv_source_2.txt mv_target_2.txt' > test_mv_no.sh; echo 'n' >> test_mv_no.sh; chmod 700 test_mv_no.sh
echo 'mv -i mv_source_2.txt mv_target_2.txt' > test_mv_yes.sh; echo 'YES' >> test_mv_yes.sh; chmod 700 test_mv_yes.sh

echo ""
echo "--- Creating assets for advanced 'find' and 'run' tests ---"
# For find -delete
touch deleteme.tmp
# For find -exec
echo "I should not be executable" > exec_test.sh; chmod 600 exec_test.sh
# For run argument test
echo 'echo "Arg 1: $1, Arg 2: $2, Arg Count: $#, All Args: $@"' > arg_test.sh; chmod 700 arg_test.sh

echo ""
echo "--- Creating assets for application tests (chidi, paint) ---"
# For chidi
mkdir -p chidi_test_docs/proposals
echo "# Project Oopis" > chidi_test_docs/README.md
echo "This project is the main OS." >> chidi_test_docs/README.md
echo "## Key Feature: AI" >> chidi_test_docs/README.md
echo "The chidi command is a key feature, an AI Librarian." >> chidi_test_docs/README.md
echo "# Proposal: GUI" > chidi_test_docs/proposals/gui.md
echo "A graphical user interface would be a great addition." >> chidi_test_docs/proposals/gui.md
touch chidi_test_docs/not_markdown.txt
# For paint
echo '{' > sample.oopic
echo '  "version": "1.1",' >> sample.oopic
echo '  "width": 3,' >> sample.oopic
echo '  "height": 2,' >> sample.oopic
echo '  "cells": [' >> sample.oopic
echo '    [{"char":"O","fg":"text-sky-400","bg":"bg-transparent"},{"char":"_","fg":"text-sky-400","bg":"bg-transparent"},{"char":"O","fg":"text-sky-400","bg":"bg-transparent"}],' >> sample.oopic
echo '    [{"char":" ","fg":"text-green-500","bg":"bg-neutral-950"},{"char":"U","fg":"text-amber-400","bg":"bg-transparent"},{"char":" ","fg":"text-green-500","bg":"bg-neutral-950"}]' >> sample.oopic
echo '  ]' >> sample.oopic
echo '}' >> sample.oopic

echo ""
echo "--- Creating assets for adventure game tests ---"
# A simple adventure game in JSON format
echo '{' > test_adv.json
echo '  "title": "The Test Chamber",' >> test_adv.json
echo '  "startingRoomId": "hallway",' >> test_adv.json
echo '  "winCondition": {"type": "itemInRoom", "itemId": "trophy", "roomId": "throne_room"},' >> test_adv.json
echo '  "winMessage": "You place the trophy on the throne. You have won the test!",' >> test_adv.json
echo '  "rooms": {' >> test_adv.json
echo '    "hallway": {' >> test_adv.json
echo '      "id": "hallway", "name": "Stone Hallway",' >> test_adv.json
echo '      "description": "A dusty hallway. A heavy oak door is to the north.",' >> test_adv.json
echo '      "exits": {"north": "oak_door"}' >> test_adv.json
echo '    },' >> test_adv.json
echo '    "throne_room": {' >> test_adv.json
echo '      "id": "throne_room", "name": "Throne Room",' >> test_adv.json
echo '      "description": "A grand room with a single throne.",' >> test_adv.json
echo '      "exits": {}' >> test_adv.json
echo '    }' >> test_adv.json
echo '  },' >> test_adv.json
echo '  "items": {' >> test_adv.json
echo '    "rusty_key": {' >> test_adv.json
echo '      "id": "rusty_key", "name": "rusty key", "location": "hallway"' >> test_adv.json
echo '    },' >> test_adv.json
echo '    "oak_door": {' >> test_adv.json
echo '      "id": "oak_door", "name": "oak door", "location": "hallway",' >> test_adv.json
echo '      "isOpenable": true, "state": "locked", "unlocksWith": "rusty_key",' >> test_adv.json
echo '      "leadsTo": "throne_room", "canTake": false' >> test_adv.json
echo '    },' >> test_adv.json
echo '    "trophy": { "id": "trophy", "name": "shiny trophy", "location": "player" }' >> test_adv.json
echo '  }' >> test_adv.json
echo '}' >> test_adv.json

# Script 1: Launch and quit
echo 'adventure ./test_adv.json' > adv_test1.sh; echo 'quit' >> adv_test1.sh; chmod 700 adv_test1.sh
# Script 2: Gameplay
echo 'adventure ./test_adv.json' > adv_test2.sh; echo 'look' >> adv_test2.sh; echo 'take rusty key' >> adv_test2.sh; echo 'inventory' >> adv_test2.sh; echo 'use rusty key on oak door' >> adv_test2.sh; echo 'open oak door' >> adv_test2.sh; echo 'go north' >> adv_test2.sh; echo 'use shiny trophy on throne' >> adv_test2.sh; echo 'quit' >> adv_test2.sh; chmod 700 adv_test2.sh
# Script 3: Saving
echo 'adventure ./test_adv.json' > adv_test3.sh; echo 'save' >> adv_test3.sh; echo 'my_save' >> adv_test3.sh; echo 'quit' >> adv_test3.sh; chmod 700 adv_test3.sh
# Script 4: Loading
echo 'adventure ./test_adv.json' > adv_test4.sh; echo 'load' >> adv_test4.sh; echo 'my_save' >> adv_test4.sh; echo 'inventory' >> adv_test4.sh; echo 'quit' >> adv_test4.sh; chmod 700 adv_test4.sh