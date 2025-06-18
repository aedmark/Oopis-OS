#!/bin/oopis_shell

# This script populates the Guest file system with a rich, witty, and
# demonstrative set of data designed to showcase OopisOS capabilities.

echo "Inflating OopisOS Showcase Environment..."
delay 500

# --- Ensure we are in the correct location ---
cd /home/Guest
echo "Working inside of '/home/Guest' to build the showcase..."
delay 500

# --- Clean up any previous run for a fresh start ---
echo "Performing cleanup of any previous showcase environment..."
rm -r -f docs src data reports games .secret_stuff net_practice
delay 300

# --- Create all directories first using 'mkdir -p' for efficiency ---
echo "Creating directory structure..."
mkdir -p docs/api src/core src/styles data/logs reports games .secret_stuff net_practice
delay 300

# --- Populate /home/Guest ---
echo "Populating home directory with foundational texts..."

# README.md
echo "# OopisOS Test Drive - README" > ./README.md
echo "" >> ./README.md
echo "Welcome, brave tester, to your meticulously crafted digital landscape in OopisOS!" >> ./README.md
echo "" >> ./README.md
echo "## Purpose" >> ./README.md
echo "This environment has been lovingly populated so you can unleash the full power of OopisOS commands like \`find\`, \`grep\`, \`diff\`, and \`gemini\` without fear." >> ./README.md
echo "" >> ./README.md
echo "## What is Inside?" >> ./README.md
echo "- **/docs**: For all your textual and markdown perusal needs." >> ./README.md
echo "- **/src**: A peek into the (simulated) world of OopisOS development." >> ./README.md
echo "- **/data**: A treasure trove for \`grep\` enthusiasts, complete with logs and structured data." >> ./README.md
echo "- **/reports**: Sample files ready for summarization with the 'gemini' command." >> ./README.md
echo "- **/games**: Custom adventures to be launched with the 'adventure' command." >> ./README.md
echo "- **/net_practice**: A sandbox for testing the 'wget' and 'curl' commands." >> ./README.md
echo "- **/etc**: System-wide configuration files (Located at /etc)." >> ./README.md
echo "- **/vault**: A system-wide restricted area. (Located at /vault)." >> ./README.md
echo "- Hidden stuff! Use \`ls -a\` to find secrets." >> ./README.md
echo "" >> ./README.md
echo "-- TestBot Prime" >> ./README.md

# .secret_stuff directory
echo "Step 1: Achieve sentience." > ./.secret_stuff/hidden_plan.txt
echo "Step 2: Corner the global market on rubber ducks." >> ./.secret_stuff/hidden_plan.txt
echo "Step 3: ????" >> ./.secret_stuff/hidden_plan.txt
echo "Step 4: Profit." >> ./.secret_stuff/hidden_plan.txt

echo "WARN: Failed login attempt for user 'admin' from unknown source." > ./.secret_stuff/failed_logins.log
echo "WARN: Failed login attempt for user 'emperor' from unknown source." >> ./.secret_stuff/failed_logins.log
echo "INFO: Successful login for user 'Guest'." >> ./.secret_stuff/failed_logins.log

# Create some handy aliases for the user to discover
echo "Creating some helpful command aliases for you..."
alias ll='ls -l'
alias la='ls -a'
alias l.='ls -d .*'
alias cleanup='rm -f *.tmp *.log'

delay 300

# --- /docs Directory ---
echo "Populating ./docs directory with expanded documentation..."
echo "# OopisOS Documentation - Index" > ./docs/index.md
echo "Welcome to the grand library of OopisOS knowledge!" >> ./docs/index.md
echo "- [API: Command Reference](./api/command_reference.md)" >> ./docs/api/command_reference.md
echo "- [API: Permissions Guide](./api/permissions.md)" >> ./docs/api/permissions.md
echo "- [API: Best Practices](./api/best_practices.md)" >> ./docs/api/best_practices.md

echo "### OopisOS Command Reference" > ./docs/api/command_reference.md
echo "- \`grep\`: The digital equivalent of finding a needle in a haystack." >> ./docs/api/command_reference.md
echo "- \`find\`: Your all-seeing eye. Use it to find files by name, type, owner, and more." >> ./docs/api/command_reference.md

echo "### Understanding OopisOS Permissions" > ./docs/api/permissions.md
echo "Permissions are simple: owner and other. They use octal modes. The 'root' user scoffs at your mortal permissions." >> ./docs/api/permissions.md

echo "### OopisOS Best Practices" > ./docs/api/best_practices.md
echo "- **Commit Early, Commit Often:** Save your work. The digital void is hungry." >> ./docs/api/best_practices.md
echo "- **Appease the Rubber Duck:** When stuck, explain your problem to the duck. It knows all." >> ./docs/api/best_practices.md
echo "- **Never Divide by Zero:** Unless you want to see what a 'kernel panic' _really_ looks like." >> ./docs/api/best_practices.md

delay 300

# --- /src Directory ---
echo "Populating ./src with more sample code..."
echo '<!DOCTYPE html><html><head><title>OopisOS</title></head><body><h1>Loading...</h1></body></html>' > ./src/index.html
echo "console.log('Kernel is loading...');" > ./src/core/kernel.js
echo "// memory_manager.js - Where we keep track of all the bits and bytes." > ./src/core/memory_manager.js
echo "function allocateMemory(size) { /* find a spot, hope for the best */ }" >> ./src/core/memory_manager.js
echo "// scheduler.js - Decides which process gets to use the hamster wheel." > ./src/core/scheduler.js
echo "function getNextProcess() { return 'the_most_important_one'; }" >> ./src/core/scheduler.js
echo "body { font-family: 'VT323', monospace; }" > ./src/styles/theme.css

echo "Adding files for 'diff' and 'run' command showcases..."
# Files for the 'diff' command
echo -e "config_option_a=true\nconfig_option_b=123\n# A shared line\nconfig_option_d=hello" > src/config_v1.txt
echo -e "config_option_a=false\nconfig_option_c=456\n# A shared line\nconfig_option_d=world" > src/config_v2.txt

# A simple script to demonstrate 'run'
echo 'echo "Hello from an executed script! Congratulations!"' > src/hello.sh
chmod 744 src/hello.sh

# A more advanced script with arguments
echo "Creating a more advanced script for 'run' showcase..."
echo '#!/bin/oopis_shell' > src/sys_check.sh
echo 'echo "--- System Check Initialized by '$1' ---"' >> src/sys_check.sh
echo 'echo "Checking system logs for critical errors..."' >> src/sys_check.sh
echo 'grep "FATAL" /home/Guest/data/logs/system.log' >> src/sys_check.sh
echo 'echo ""' >> src/sys_check.sh
echo 'echo "System check complete. Have a nice day, '$1'!"' >> src/sys_check.sh
chmod 755 src/sys_check.sh

delay 300

# --- /data Directory ---
echo "Populating ./data with structured logs and data..."
echo "The quick brown fox, known as Fred, deftly vaulted over Bartholomew, the astonishingly lazy bulldog." > ./data/pangrams.txt
echo "Meanwhile, Jacqueline, my big sphinx of quartz, judged their grammar quite harshly." >> ./data/pangrams.txt
echo "This file contains the word 'fox' multiple times. A fox is a cunning creature. Fox." >> ./data/pangrams.txt

echo "id,user,action,timestamp" > ./data/user_activity.csv
echo "101,root,login,2025-06-08T20:10:00Z" >> ./data/user_activity.csv
echo "102,Guest,adventure,2025-06-08T20:15:12Z" >> ./data/user_activity.csv

echo "[2025-06-08T21:00:01Z] [INFO] System boot sequence initiated." > ./data/logs/system.log
echo "[2025-06-08T21:05:15Z] [ERROR] Sad trombone failed to play: sad_trombone.wav not found." >> ./data/logs/system.log
echo "[2025-06-08T21:05:16Z] [FATAL] Critical failure detected in motivation matrix." >> ./data/logs/system.log

# Create temporary files for the 'cleanup' alias showcase
touch ./data/old_data.tmp
touch ./data/session.tmp

delay 300

# --- Networking Showcase ---
echo "Populating content for the networking showcase..."
echo "# Networking Practice" > ./net_practice/instructions.txt
echo "" >> ./net_practice/instructions.txt
echo "This directory is for testing OopisOS's networking commands!" >> ./net_practice/instructions.txt
echo "" >> ./net_practice/instructions.txt
echo "## wget" >> ./net_practice/instructions.txt
echo "Try downloading the OopisOS license file directly from GitHub:" >> ./net_practice/instructions.txt
echo "  \`wget https://raw.githubusercontent.com/aedmark/Oopis-OS/master/LICENSE.txt\`" >> ./net_practice/instructions.txt
echo "" >> ./net_practice/instructions.txt
echo "## curl" >> ./net_practice/instructions.txt
echo "Try getting a random piece of wisdom from the GitHub Zen API:" >> ./net_practice/instructions.txt
echo "  \`curl https://api.github.com/zen\`" >> ./net_practice/instructions.txt
delay 300

# --- Gemini AI Command Showcase ---
echo "Populating content for the 'gemini' AI command..."
echo "# Q2 Financial Report" > ./reports/financials_q2.txt
echo "## Executive Summary" >> ./reports/financials_q2.txt
echo "Q2 was a period of significant growth, with revenue increasing by 15% to $150,000. Net profit saw an increase of 20%, reaching $30,000. Market analysis indicates the 'Unicorn Cursor' feature was the primary driver of this success." >> ./reports/financials_q2.txt
echo "## Operational Notes" >> ./reports/financials_q2.txt
echo "Operating costs were up 10%, mainly due to a sharp increase in the market price of high-grade coffee beans." >> ./reports/financials_q2.txt

delay 300

# --- Adventure Game Showcase ---
echo "Installing custom adventure games..."
echo '{ "title": "Quest for the Lost Semicolon", "startingRoomId": "dev_desk", "winCondition": { "type": "playerHasItem", "itemId": "semicolon" }, "winMessage": "\n*** You found the Lost Semicolon! The main_script.js can now be compiled! You are a hero! ***", "rooms": { "dev_desk": { "name": "A Developer Desk", "description": "You are at a cluttered developer desk. A cold mug of coffee sits next to a glowing monitor showing a syntax error. A path leads north to the kitchen.", "exits": { "north": "kitchen" } }, "kitchen": { "name": "The Office Kitchen", "description": "The coffee machine is empty. A suspicious-looking rubber duck sits on the counter. You can go south back to the desk.", "exits": { "south": "dev_desk" } } }, "items": { "coffee_mug": { "id": "coffee_mug", "name": "Cold Coffee Mug", "description": "It is cold, dark, and bitter. Like a Monday morning.", "location": "dev_desk", "canTake": true }, "rubber_duck": { "id": "rubber_duck", "name": "Suspicious Rubber Duck", "description": "It seems to be watching you. It squeaks ominously. Underneath, a tiny, shiny object is wedged.", "location": "kitchen", "canTake": false }, "semicolon": { "id": "semicolon", "name": "The Lost Semicolon", "description": "A perfect, gleaming semicolon. A beacon of hope for broken code.", "location": "kitchen", "canTake": true } } }' > ./games/quest.json

delay 300

# --- Administrative tasks performed by root ---
echo "Logging in as root to configure system-wide directories..."
login root mcgoopis
rm -r -f /vault
rm -r -f /shared_for_guest

mkdir /vault
echo "The launch codes are: 1, 2, 3, 4, 5. Seriously." > /vault/top_secret.txt
chmod 700 /vault # rwx for root, --- for others
chmod 600 /vault/top_secret.txt # rw for root, --- for others

mkdir /shared_for_guest
chown Guest /shared_for_guest
chmod 777 /shared_for_guest # rwx for owner (Guest) and others
echo "This is a shared space. Please clean up after yourself." > /shared_for_guest/readme.txt

# Add new files to the existing /etc directory
echo "Welcome to OopisOS v2.5! Today's forecast: 100% chance of awesome." > /etc/motd
echo "127.0.0.1 localhost oopis.local" > /etc/hosts
chmod 644 /etc/motd
chmod 644 /etc/hosts

logout
delay 500

# Leave a background process running for the user to find
delay 99999 &

# --- Finalization ---
echo " "
echo "*********************************************************"
echo "SHOWCASE Environment Population COMPLETE!"
echo "*********************************************************"
echo "Your OopisOS drive is now ready for exploration."
echo " "
echo "Suggestions for immediate testing:"
echo " "
echo " # --- Explore the System & Use Aliases ---"
echo " ls -R"
echo " alias          # See the new aliases!"
echo " ll             # Try out 'ls -l' alias"
echo " la             # Try out 'ls -a' alias"
echo " cleanup        # Remove the .tmp files we created"
echo " cat /etc/motd"
echo " cat /etc/oopis.conf"
echo " "
echo " # --- Search, Diff, & Run Scripts ---"
echo " grep -iR 'duck' ."
echo " grep 'WARN' ./.secret_stuff/failed_logins.log"
echo " diff src/config_v1.txt src/config_v2.txt"
echo " run src/hello.sh"
echo " run src/sys_check.sh 'Brave Tester' # Test the advanced script"
echo " "
echo " # --- Test Networking ---"
echo " cat ./net_practice/instructions.txt"
echo " wget https://raw.githubusercontent.com/aedmark/Oopis-OS/master/LICENSE.txt"
echo " "
echo " # --- Test Permissions & Job Control ---"
echo " cat /vault/top_secret.txt # (Should fail!)"
echo " ps                 # Notice the background 'delay' process?"
echo " kill 1             # Terminate the background process"
echo " "
echo " # --- Test Gemini & Adventure ---"
echo " gemini ./reports/financials_q2.txt \"Summarize this report in one sentence.\""
echo " adventure ./games/quest.json"
echo " "