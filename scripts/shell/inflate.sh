#!/bin/oopis_shell

# inflate.sh - The OopisOS Instant Universe Generator (v5.1)
# Run this and watch a sterile, empty void blossom into a bustling digital ecosystem.

echo "Initiating World-Build Protocol v5..."
delay 500

echo "Warning: Spontaneous generation of files and directories is imminent."
delay 500

# --- Teleporting to the build site ---
cd /home/Guest
echo "Confirmed location: /home/Guest. This is where the magic happens."
delay 500

# --- Preparing the canvas (by burning the old one) ---
echo "Sanitizing the area. Out with the old, in with the weird."
rm -r -f docs src data reports games .secret_stuff net_practice archive_this my_archive.zip find_test zip_test programs todo.txt music twinkle.sh
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
echo "body { font-family: VT323, monospace; color: #00FF00; background-color: #000000; }" > ./src/styles/theme.css
echo "Creating evidence of a rival..."
echo -e "config_option_a=true\nconfig_option_b=999\n# A shared line\nconfig_option_d=hello\n# Hacked by Morpheus" > src/config_v1.hacked
echo "#!/bin/oopis_shell" > src/fix_me.sh
echo "echo 'This script is supposed to list the contents of a directory.'" >> src/fix_me.sh
echo "TARGET_DIR='/home/Guest/docs'" >> src/fix_me.sh
echo "cd $TARGET_DIR" >> src/fix_me.sh
echo "ls" >> src/fix_me.sh
echo "echo '...but this next part is broken.'" >> src/fix_me.sh
echo "TARGET_FILE='/home/Guest/README.md'" >> src/fix_me.sh
chmod 755 src/fix_me.sh
delay 300
echo '#!/bin/oopis_shell' > src/backup_docs.sh
echo '# Creates a timestamped zip of the docs directory' >> src/backup_docs.sh
echo 'TIMESTAMP=$(date | awk "{print \$2_\$3_\$6}")' >> src/backup_docs.sh
echo 'FILENAME="docs_backup_$TIMESTAMP.zip"' >> src/backup_docs.sh
echo 'echo "Backing up /home/Guest/docs to $FILENAME..."' >> src/backup_docs.sh
echo 'zip $FILENAME /home/Guest/docs' >> src/backup_docs.sh
chmod 755 src/backup_docs.sh
delay 500

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
echo "[2025-06-08T22:10:00Z] [DEBUG] User 'Guest' ran 'ls -l'. It was beautiful." >> ./data/logs/system.log
echo "[2025-06-08T22:11:00Z] [INFO] AI 'chidi' successfully summarized 3 documents." >> ./data/logs/system.log
echo "[2025-06-08T22:15:00Z] [WARN] Filesystem at 88% capacity. Consider running 'cleanup'." >> ./data/logs/system.log
echo "id,product,region,units_sold,revenue" > ./data/analysis/sales.csv
echo "1,Duck,NA,500,2500.00" >> ./data/analysis/sales.csv
echo "2,Semicolon,EU,1200,120.00" >> ./data/analysis/sales.csv
echo "3,Duck,APAC,350,1750.00" >> ./data/analysis/sales.csv
echo "4,Mug,NA,800,4000.00" >> ./data/analysis/sales.csv
delay 300
echo "Generating faulty filenames"
delay 300
echo "This filename has spaces" > "./data/a file with spaces.txt"
echo "This one has a quote" > "./data/a_quote's_file.txt"
echo "This one has... everything" > "./data/(all-the-symbols!@#\$%^&).data"

delay 500

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
delay 300

# --- NEW: System Corruption Simulation for fsck testing ---
echo "Initiating controlled demolition... for science! Creating test cases for fsck."
mkdir /var/audit_test
# 1. Dangling symlink
echo "Creating a dead-end street sign..."
touch /var/audit_test/will_vanish.txt
ln -s /var/audit_test/will_vanish.txt /var/audit_test/dangling_link
rm /var/audit_test/will_vanish.txt
# 2. Orphaned file
echo "Creating a file owned by a ghost..."
useradd ghost_user
temppass
temppass
groupadd phantom_group
touch /var/audit_test/orphaned_file.txt
chown ghost_user /var/audit_test/orphaned_file.txt
chgrp phantom_group /var/audit_test/orphaned_file.txt
removeuser -f ghost_user
groupdel phantom_group
# 3. User home directory issues
echo "Evicting some users and squatting in their homes..."
useradd homeless_joe
pass
pass
rm -r /home/homeless_joe
useradd file_house_pete
pass
pass
rm -r /home/file_house_pete
touch /home/file_house_pete
useradd squatter_sue
pass
pass
chown root /home/squatter_sue
delay 500

echo "Creating a more complex user/group environment..."
groupadd developers
delay 200
useradd dev1
newpass
newpass
delay 200
groupadd research
useradd analyst
testpass
testpass
delay 200
usermod -aG research dev1
usermod -aG research analyst
mkdir /home/project_y
chown dev1 /home/project_y
chgrp research /home/project_y
chmod 770 /home/project_y
echo "# Project Y - Market Analysis\nCONFIDENTIAL - For 'research' group only." > /home/project_y/README.md
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
delay 200
usermod -aG developers dev1
mkdir /home/project_x
chgrp developers /home/project_x
chmod 770 /home/project_x
echo "# Project X - Top Secret\nDo not share with marketing." > /home/project_x/brief.md
mkdir /home/project_y/archive
chown root /home/project_y/archive
chmod 755 /home/project_y/archive # Everyone can enter and read, only root can write.
echo "Q1 data. Do not modify." > /home/project_y/archive/q1_data.bak

delay 500
login Guest
delay 500
mkdir music
echo "# Twinkle, Twinkle, Little Star" > twinkle.sh
echo "play C4 4n; delay 50; play C4 4n; delay 50; play G4 4n; delay 50; play G4 4n; delay 50; play A4 4n; delay 50; play A4 4n; delay 50; play G4 2n; delay 100; play F4 4n; delay 50; play F4 4n; delay 50; play E4 4n; delay 50; play E4 4n; delay 50; play D4 4n; delay 50; play D4 4n; delay 50; play C4 2n" >> twinkle.sh
chmod 700 twinkle.sh

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
echo "  > \`find . -name \"*.txt\" | xargs wc -l\` to see find and xargs in action."
echo "  > \`cat /vault/top_secret.txt\` to test the security system (it'll fail)."
echo "  > \`chidi ./docs\` to have the AI read you the new, improved manuals."
echo "  > \`adventure ./games/quest.json\` to start your epic quest."
echo "  > \`sudo fsck --repair\` to find and fix the problems we just created!"
echo " "

# A todo list to guide the user
echo "# My OopisOS Todo List" > ./todo.txt
echo "- [ ] Investigate the .secret_stuff directory." >> ./todo.txt
echo "- [ ] Figure out what 'sys_check.sh' is for and run it." >> ./todo.txt
echo "- [ ] Find out who 'Morpheus' is." >> ./todo.txt
echo "- [ ] Beat the 'Quest for the Lost Semicolon' adventure." >> ./todo.txt
echo "- [ ] Delete all the weirdly-named files in /data using a single 'find | xargs' command." >> ./todo.txt
echo "- [ ] Make some /music with the run, synth and play commands"
play C4 12n; play E4 12n; play G4 10n; play C5 8n; play G4 12n; play C5 2n
delay 400
echo " "
echo " "
echo " "
delay 200