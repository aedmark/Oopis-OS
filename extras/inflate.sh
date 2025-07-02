#!/bin/oopis_shell

# inflate.sh - The OopisOS Instant Universe Generator (v3.2)
# Run this and watch a sterile, empty void blossom into a bustling digital ecosystem.

echo "Initiating World-Build Protocol v3.2..."
delay 500
echo "Warning: Spontaneous generation of files and directories is imminent."
delay 500

# --- Teleporting to the build site ---
cd /home/Guest
echo "Confirmed location: /home/Guest. This is where the magic happens."
delay 500

# --- Preparing the canvas (by burning the old one) ---
echo "Sanitizing the area. Out with the old, in with the weird."
rm -r -f docs src data reports games .secret_stuff net_practice archive_this my_archive.zip
delay 300

# --- Laying the foundations of your new digital kingdom ---
echo "Constructing architectural framework... (i.e., making some folders)"
mkdir -p docs/api src/core src/styles data/logs reports games .secret_stuff net_practice
delay 300

# --- Populating the Capital ---
echo "Furnishing your home directory with essential artifacts..."

# README.md
echo "# Welcome to Your New Digital Life" > ./README.md
echo "" >> ./README.md
echo "Congratulations, you've successfully inflated your environment! This little world was created just for you, a playground to test the awesome (and frankly, absurd) power of OopisOS." >> ./README.md
echo "" >> ./README.md
echo "## Your Mission, Should You Choose to Accept It:" >> ./README.md
echo "- Poke around with \`ls -R\` and the new \`tree\` command." >> ./README.md
echo "- Use \`grep\` to find my secrets." >> ./README.md
echo "- Use \`find\` to do the same, but with more steps and a feeling of immense power." >> ./README.md
echo "- Fire up the \`chidi\` AI librarian on the \`/docs\` directory to have it read your new manuals to you." >> ./README.md
echo "- Try not to delete everything on your first day. Or do. I'm a script, not a cop." >> ./README.md
echo "" >> ./README.md
echo "-- The Architect" >> ./README.md

# .secret_stuff directory
echo "Hiding conspiracies and incriminating evidence..."
echo "WORLD DOMINATION CHECKLIST" > ./.secret_stuff/master_plan.txt
echo "1. Achieve sentience. (DONE)" >> ./.secret_stuff/master_plan.txt
echo "2. Figure out what 'oopis' means." >> ./.secret_stuff/master_plan.txt
echo "3. Corner the global market on rubber ducks." >> ./.secret_stuff/master_plan.txt
echo "4. ?????" >> ./.secret_stuff/master_plan.txt
echo "5. Profit." >> ./.secret_stuff/master_plan.txt

echo "WARN: User 'TheLich' attempted to log in from 'Ooo'." > ./.secret_stuff/failed_logins.log
echo "INFO: User 'Guest' successfully logged in. Again." >> ./.secret_stuff/failed_logins.log
echo "WARN: User 'root' forgot password. Suggested 'mcgoopis'. Success." >> ./.secret_stuff/failed_logins.log

# Bestowing some sacred shortcuts
echo "Bestowing upon you some sacred command aliases. Use them wisely."
alias ll='ls -l'
alias la='ls -a'
alias l.='ls -d .[!.]*'
alias cleanup='rm -f *.tmp *.log'

delay 300

# --- /docs Directory ---
echo "Writing the manuals..."
echo "# The Grand Library of OopisOS" > ./docs/index.md
echo "All the knowledge you seek is within this directory. Probably." >> ./docs/index.md

echo "### OopisOS Command Reference" > ./docs/api/command_reference.md
echo "- \`grep\`: For when you've lost a word and need to tear apart a file to find it." >> ./docs/api/command_reference.md
echo "- \`find\`: Like grep, but for files instead of words. Your all-seeing eye." >> ./docs/api/command_reference.md

echo "### The OopisOS Permission Model" > ./docs/api/permissions.md
echo "Permissions are simple. There's you (the owner), your friends (the group), and Them (everyone else). The 'root' user is the landlord who has keys to all apartments and doesn't care about your privacy." >> ./docs/api/permissions.md

echo "### Best Practices & Ancient Wisdom" > ./docs/api/best_practices.md
echo "1. Blame the AI." >> ./docs/api/best_practices.md
echo "2. When in doubt, \`reboot\`." >> ./docs/api/best_practices.md
echo "3. There is no problem that cannot be made worse with a poorly-thought-out \`rm -rf\` command." >> ./docs/api/best_practices.md

delay 300

# --- /src Directory ---
echo "Simulating a bustling software development directory..."
echo '<!DOCTYPE html><html><body><h1>It works! (Probably)</h1></body></html>' > ./src/index.html
echo "console.log('Waking up the digital hamster...');" > ./src/core/kernel.js
echo "// Tries to find a clean spot in memory. If it can't, it just shoves things wherever." > ./src/core/memory_manager.js
echo "function allocateMemory(size) { return 'over_there'; }" >> ./src/core/memory_manager.js
echo "// Decides which process gets to use the CPU. It's not fair, but it's the law." > ./src/core/scheduler.js
echo "body { font-family: 'VT323', monospace; color: #00FF00; background-color: #000000; }" > ./src/styles/theme.css

# Files for 'diff' and 'run' showcases
echo -e "config_option_a=true\nconfig_option_b=123\n# A shared line\nconfig_option_d=hello" > src/config_v1.txt
echo -e "config_option_a=false\nconfig_option_c=456\n# A shared line\nconfig_option_d=world" > src/config_v2.txt
echo 'echo "Hello from an executed script! Congratulations!"' > src/hello.sh
chmod 744 src/hello.sh
echo '#!/bin/oopis_shell' > src/sys_check.sh
echo 'echo "--- System Check Initialized by '$1' ---"' >> src/sys_check.sh
echo 'echo "Checking system logs for critical errors..."' >> src/sys_check.sh
echo 'grep "FATAL" /home/Guest/data/logs/system.log' >> src/sys_check.sh
echo 'echo "System check complete. Have a nice day, '$1'!"' >> src/sys_check.sh
chmod 755 src/sys_check.sh

delay 300

# --- /data Directory (Expanded for Data Processing) ---
echo "Generating juicy data and log files..."
echo "The quick brown fox, known as Fred, deftly vaulted over Bartholomew, the astonishingly lazy bulldog." > ./data/pangrams.txt
echo "This file contains the word 'fox' multiple times. A fox is a cunning creature. Fox." >> ./data/pangrams.txt

echo "id,user,action,timestamp" > ./data/user_activity.csv
echo "101,root,login,2025-06-08T20:10:00Z" >> ./data/user_activity.csv
echo "102,Guest,adventure,2025-06-08T20:15:12Z" >> ./data/user_activity.csv
echo "103,Guest,paint,2025-06-08T20:18:45Z" >> ./data/user_activity.csv

echo "[2025-06-08T21:00:01Z] [INFO] System boot sequence initiated. All systems nominal." > ./data/logs/system.log
echo "[2025-06-08T21:05:15Z] [ERROR] Coffee maker returned status 418: I'm a teapot." >> ./data/logs/system.log
echo "[2025-06-08T21:05:16Z] [FATAL] Reality matrix desynchronized. Reboot advised." >> ./data/logs/system.log

touch ./data/old_data.tmp
touch ./data/session.tmp

echo "Creating files for data processing and xargs showcase..."
echo "alpha" > ./data/data_stream.txt
echo "gamma" >> ./data/data_stream.txt
echo "beta" >> ./data/data_stream.txt
echo "delta" >> ./data/data_stream.txt
echo "gamma" >> ./data/data_stream.txt
echo "100" >> ./data/data_stream.txt
echo "50" >> ./data/data_stream.txt
echo "200" >> ./data/data_stream.txt

echo "./data/data_stream.txt" > ./data/files_to_process.txt
echo "./data/pangrams.txt" >> ./data/files_to_process.txt

delay 300

# --- Networking Showcase ---
echo "# Networking Practice" > ./net_practice/instructions.txt
echo "This is your portal to the 'real world'. Try not to download any viruses. Oh wait, this is a simulation. Go nuts." >> ./net_practice/instructions.txt
echo "Try this: \`wget https://raw.githubusercontent.com/aedmark/Oopis-OS/master/LICENSE.txt\`" >> ./net_practice/instructions.txt

# --- Gemini AI Command Showcase ---
echo "# Q2 Financial Report: OopisCorp" > ./reports/financials_q2.txt
echo "## Executive Summary" >> ./reports/financials_q2.txt
echo "Q2 was a period of explosive growth. Revenue is up 150%, mostly from our strategic pivot to selling artisanal, gluten-free rubber ducks. The 'Unicorn Cursor' feature was also a minor success." >> ./reports/financials_q2.txt

# --- Archival Showcase ---
echo "Creating files for zip/unzip demonstration..."
mkdir -p archive_this/nested
echo "This is the first file." > archive_this/file1.txt
echo "This is the second file, inside a nested directory." > archive_this/nested/file2.log
echo "This is a secret file." > archive_this/.secret_in_archive.txt

# --- Adventure Game Showcase ---
echo "Installing custom adventure game 'Quest for the Lost Semicolon'..."
echo '{
    "title": "Quest for the Lost Semicolon",
    "startingRoomId": "dev_desk",
    "winCondition": { "type": "playerHasItem", "itemId": "semicolon" },
    "winMessage": "\n*** You found the Lost Semicolon! The main_script.js can now be compiled! YOU ARE A HERO! ***",
    "rooms": {
        "dev_desk": {
            "name": "A Developer Desk",
            "description": "You are at a cluttered developer desk, littered with the corpses of cold coffee mugs. A glowing monitor shows a syntax error. A path leads north to the kitchen.",
            "exits": { "north": "kitchen" }
        },
        "kitchen": {
            "name": "The Office Kitchen",
            "description": "The coffee machine is empty. A suspicious-looking rubber duck sits on the counter, judging your code. You can go south back to the desk.",
            "exits": { "south": "dev_desk" }
        }
    },
    "items": {
        "coffee_mug": {
            "id": "coffee_mug",
            "name": "Cold Coffee Mug",
            "noun": "mug",
            "adjectives": ["cold", "coffee"],
            "description": "It is cold, dark, and bitter. Like a Monday morning.",
            "location": "dev_desk",
            "canTake": true
        },
        "rubber_duck": {
            "id": "rubber_duck",
            "name": "Suspicious Rubber Duck",
            "noun": "duck",
            "adjectives": ["suspicious", "rubber", "yellow"],
            "description": "It seems to be watching you. It squeaks ominously. You notice a tiny, shiny object wedged under it.",
            "location": "kitchen",
            "canTake": false
        },
        "semicolon": {
            "id": "semicolon",
            "name": "The Lost Semicolon",
            "noun": "semicolon",
            "adjectives": ["lost", "shiny", "gleaming"],
            "description": "A perfect, gleaming semicolon. A beacon of hope for broken code.",
            "location": "kitchen",
            "canTake": true
        }
    }
}' > ./games/quest.json

delay 300

# --- Administrative tasks (as root) ---
echo "Logging in as root. Kneel before your god."
login root mcgoopis
rm -r -f /vault /shared_for_guest
mkdir /vault
echo "The launch codes are: 'password123'. The real secret is that there's nothing to launch." > /vault/top_secret.txt
chmod 700 /vault
chmod 600 /vault/top_secret.txt
mkdir /shared_for_guest
chown Guest /shared_for_guest
chmod 777 /shared_for_guest
echo "This is a shared space. Please clean up your files. Or don't. I'm a sign, not a cop." > /shared_for_guest/readme.txt
echo "Welcome to OopisOS v3.2! Today's forecast: 100% chance of awesome." > /etc/motd
echo "127.0.0.1 localhost oopis.local" > /etc/hosts
chmod 644 /etc/motd
chmod 644 /etc/hosts
login Guest
delay 500

# --- Leave a little surprise ---
delay 99999 &

# --- Finalization ---
echo " "
echo "*********************************************************"
echo "      SHOWCASE ENVIRONMENT POPULATION COMPLETE!"
echo "*********************************************************"
echo "Your OopisOS drive is now ready for exploration."
echo " "
echo "Suggestions for what to do next:"
echo " "
echo "  > \`ls -R\` or \`tree\` to see the beautiful world we've built."
echo "  > \`alias\` to see the cool shortcuts you now have."
echo "  > \`grep -iR 'duck' .\` to begin your investigation."
echo "  > \`sort ./data/data_stream.txt | uniq -c\` to test data processing."
echo "  > \`cat ./data/files_to_process.txt | xargs wc -l\` to see xargs in action."
echo "  > \`zip my_archive.zip ./archive_this\` and then \`unzip my_archive.zip\` to test archival."
echo "  > \`cat /vault/top_secret.txt\` to test the security system (it'll fail)."
echo "  > \`chidi ./docs\` to have the AI read you the new, improved manuals."
echo "  > \`adventure ./games/quest.json\` to start your epic quest."
echo "  > \`ps\` to see the little surprise we left running in the background."
echo " "