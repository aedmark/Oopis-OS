#!/bin/oopis_shell

# inflate.sh - The OopisOS Instant Universe Generator (v3.5)
# Run this and watch a sterile, empty void blossom into a bustling digital ecosystem.

echo "Initiating World-Build Protocol v3.5..."
delay 500
echo "Warning: Spontaneous generation of files and directories is imminent."
delay 500

# --- Teleporting to the build site ---
cd /home/Guest
echo "Confirmed location: /home/Guest. This is where the magic happens."
delay 500

# --- Preparing the canvas (by burning the old one) ---
echo "Sanitizing the area. Out with the old, in with the weird."
rm -r -f docs src data reports games .secret_stuff net_practice archive_this my_archive.zip find_test zip_test
delay 300

# --- Laying the foundations of your new digital kingdom ---
echo "Constructing architectural framework... (i.e., making some folders)"
mkdir -p docs/api src/core/utils src/styles data/logs data/analysis reports games .secret_stuff net_practice
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

# --- /src Directory (with added subdirectory for tree/grep -R tests) ---
echo "Simulating a bustling software development directory..."
echo '<!DOCTYPE html><html><body><h1>It works! (Probably)</h1></body></html>' > ./src/index.html
echo "console.log('Waking up the digital hamster...');" > ./src/core/kernel.js
echo "// Tries to find a clean spot in memory. If it can't, it just shoves things wherever." > ./src/core/memory_manager.js
echo "function allocateMemory(size) { return 'over_there'; }" >> ./src/core/memory_manager.js
echo "// Decides which process gets to use the CPU. It's not fair, but it's the law." > ./src/core/scheduler.js
echo "/* The main component for rendering UI. Contains the secret 'make_pretty' function. */" > ./src/core/utils/renderer.js
echo "body { font-family: 'VT323', monospace; color: #00FF00; background-color: #000000; }" > ./src/styles/theme.css
echo "Creating evidence of a rival..."
echo -e "config_option_a=true\nconfig_option_b=999\n# A shared line\nconfig_option_d=hello\n# Hacked by Morpheus" > src/config_v1.hacked
# A broken script for the user to fix
echo "echo 'This script is supposed to work, but it needs your help!'" > src/fix_me.sh
chmod 644 src/fix_me.sh
delay 300

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
echo "Generating juicy data and log files for analysis..."
echo -e "zeta\nalpha\nbeta\nalpha\n10\n2" > ./data/sort_test.txt
echo -e "user_a,50,active\nuser_b,150,inactive\nuser_c,99,active\nuser_d,200,active" > ./data/analysis/metrics.csv
echo -e "ERROR: Service failed\nINFO: Service started\nWARN: Deprecated call\nERROR: Connection refused\nERROR: Service failed" > ./data/analysis/events.log
echo "The quick brown fox, known as Fred, deftly vaulted over Bartholomew, the astonishingly lazy bulldog." > ./data/pangrams.txt
echo "This file contains the word 'fox' multiple times. A fox is a cunning creature. Fox." >> ./data/pangrams.txt
echo "[2025-06-08T21:00:01Z] [INFO] System boot sequence initiated. All systems nominal." > ./data/logs/system.log
echo "[2025-06-08T21:05:15Z] [ERROR] Coffee maker returned status 418: I'm a teapot." >> ./data/logs/system.log
echo "[2025-06-08T21:05:16Z] [FATAL] Reality matrix desynchronized. Reboot advised." >> ./data/logs/system.log
touch ./data/old_data.tmp
touch ./data/session.tmp
echo "./data/sort_test.txt" > ./data/files_to_process.txt
echo "./data/pangrams.txt" >> ./data/files_to_process.txt

delay 300

# --- BASIC Showcase ---
echo "Writing a sample BASIC program..."
mkdir -p programs
echo '10 REM Oopis Basic Showcase' > ./programs/demo.bas
echo '20 PRINT "HELLO FROM OOPIS BASIC!"' >> ./programs/demo.bas
echo '30 PRINT "LISTING FILES IN /home/Guest..."' >> ./programs/demo.bas
echo '40 LET D$ = SYS_CMD("ls /home/Guest")' >> ./programs/demo.bas
echo '50 PRINT D$' >> ./programs/demo.bas
echo '60 INPUT "WHAT IS YOUR NAME? ", N$' >> ./programs/demo.bas
echo '70 PRINT "GOODBYE, " + N$' >> ./programs/demo.bas

# --- Assets for find, zip, and other new tests ---
echo "Creating dedicated assets for advanced diagnostics..."
mkdir -p find_test/subdir
touch find_test/a.txt
touch find_test/b.tmp
touch find_test/subdir/c.tmp
chmod 777 find_test/a.txt

mkdir -p zip_test/nested_dir
echo "file one content" > zip_test/file1.txt
echo "nested file content" > zip_test/nested_dir/file2.txt

# --- Networking Showcase ---
echo "# Networking Practice" > ./net_practice/instructions.txt
echo "This is your portal to the 'real world'. Try not to download any viruses. Oh wait, this is a simulation. Go nuts." >> ./net_practice/instructions.txt
echo "Try this: \`wget https://raw.githubusercontent.com/aedmark/Oopis-OS/master/LICENSE.txt\`" >> ./net_practice/instructions.txt

# --- Gemini AI Command Showcase ---
echo "# Q2 Financial Report: OopisCorp" > ./reports/financials_q2.txt
echo "## Executive Summary" >> ./reports/financials_q2.txt
echo "Q2 was a period of explosive growth. Revenue is up 150%, mostly from our strategic pivot to selling artisanal, gluten-free rubber ducks. The 'Unicorn Cursor' feature was also a minor success." >> ./reports/financials_q2.txt

# --- Adventure Game Showcase ---
echo "Installing custom adventure game 'Quest for the Lost Semicolon'..."
echo "{\"title\": \"Quest for the Lost Semicolon\",\"startingRoomId\": \"dev_desk\",\"winCondition\": { \"type\": \"playerHasItem\", \"itemId\": \"semicolon\" },\"winMessage\": \"\n*** You found the Lost Semicolon! The main_script.js can now be compiled! YOU ARE A HERO! ***\",\"rooms\": {\"dev_desk\": {\"name\": \"A Developer Desk\",\"description\": \"You are at a cluttered developer desk, littered with the corpses of cold coffee mugs. A glowing monitor shows a syntax error. A path leads north to the kitchen.\",\"exits\": { \"north\": \"kitchen\" }},\"kitchen\": {\"name\": \"The Office Kitchen\",\"description\": \"The coffee machine is empty. A suspicious-looking rubber duck sits on the counter, judging your code. You can go south back to the desk.\",\"exits\": { \"south\": \"dev_desk\" }}},\"items\": {\"coffee_mug\": {\"id\": \"coffee_mug\",\"name\": \"Cold Coffee Mug\",\"noun\": \"mug\",\"adjectives\": [\"cold\", \"coffee\"],\"description\": \"It is cold, dark, and bitter. Like a Monday morning.\",\"location\": \"dev_desk\",\"canTake\": true},\"rubber_duck\": {\"id\": \"rubber_duck\",\"name\": \"Suspicious Rubber Duck\",\"noun\": \"duck\",\"adjectives\": [\"suspicious\", \"rubber\", \"yellow\"],\"description\": \"It seems to be watching you. It squeaks ominously. You notice a tiny, shiny object wedged under it.\",\"location\": \"kitchen\",\"canTake\": false},\"semicolon\": {\"id\": \"semicolon\",\"name\": \"The Lost Semicolon\",\"noun\": \"semicolon\",\"adjectives\": [\"lost\", \"shiny\", \"gleaming\"],\"description\": \"A perfect, gleaming semicolon. A beacon of hope for broken code.\",\"location\": \"kitchen\",\"canTake\": true}}}" > ./games/quest.json

delay 300

# --- Administrative tasks (as root) ---
echo "Logging in as root. Kneel before your god."
login root mcgoopis
rm -r -f /vault /shared_for_guest /home/clearfs_tester
mkdir /vault
echo "The launch codes are: 'password123'. The real secret is that there's nothing to launch." > /vault/top_secret.txt
chmod 700 /vault
chmod 600 /vault/top_secret.txt
mkdir /shared_for_guest
chown Guest /shared_for_guest
chmod 777 /shared_for_guest
echo "Welcome to OopisOS v3.5! Today's forecast: 100% chance of awesome." > /etc/motd
echo "127.0.0.1 localhost oopis.local" > /etc/hosts
chmod 644 /etc/motd
chmod 644 /etc/hosts
# Create a dedicated user for clearfs testing
useradd clearfs_tester
testpass
testpass
login clearfs_tester testpass
echo "This file is destined for oblivion." > ./doomed.txt
mkdir ./doomed_dir
echo "So long, and thanks for all the fish." > ./doomed_dir/message.txt
login root mcgoopis
echo "Setting up a shared project for a new developer..."
groupadd developers
useradd dev1
newpass
newpass
usermod -aG developers dev1
mkdir /home/project_x
chgrp developers /home/project_x
chmod 770 /home/project_x
echo "# Project X - Top Secret\nDo not share with marketing." > /home/project_x/brief.md

delay 500
login Guest
delay 500

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
echo "  > \`sort ./data/sort_test.txt | uniq -c\` to test data processing."
echo "  > \`find . -name \"*.txt\" | xargs wc -l\` to see find and xargs in action."
echo "  > \`zip my_archive.zip ./src\` and then \`unzip my_archive.zip\` to test archival."
echo "  > \`cat /vault/top_secret.txt\` to test the security system (it'll fail)."
echo "  > \`chidi ./docs\` to have the AI read you the new, improved manuals."
echo "  > \`adventure ./games/quest.json\` to start your epic quest."
echo " "

# A todo list to guide the user
echo "# My OopisOS Todo List" > ./todo.txt
echo "- [ ] Investigate the .secret_stuff directory." >> ./todo.txt
echo "- [ ] Figure out what 'sys_check.sh' is for and run it." >> ./todo.txt
echo "- [ ] Find out who 'Morpheus' is." >> ./todo.txt
echo "- [ ] Beat the 'Quest for the Lost Semicolon' adventure." >> ./todo.txt