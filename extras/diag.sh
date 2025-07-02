echo "===== OopisOS Core Test Suite v3.2 Initializing ====="
echo "This script tests non-interactive core functionality, including"
echo "scripted interactive prompts and the adventure game engine."
echo "---------------------------------------------------------------------"
echo ""

# --- Phase 1: Login and Workspace Preparation ---
echo "--- Phase: Logging in as 'root' and Preparing Workspace ---"
login root mcgoopis
delay 400
check_fail "removeuser -f root"
delay 800
mkdir /home/userDiag/diag_workspace/
chown userDiag /home/userDiag/diag_workspace/
cp /home/Guest/diag_assets.sh /home/userDiag/diag_workspace/diag_assets.sh
chown userDiag /home/userDiag/diag_workspace/diag_assets.sh
chmod 700 /home/userDiag/diag_workspace/diag_assets.sh

# --- Phase 1.2: Create Sudo Test Scripts ---
echo "--- Phase: Creating sudo helper scripts ---"
echo '#!/bin/oopis_shell' > /sudo_test_script.sh
echo 'echo "Attempting to run sudo command..."' >> /sudo_test_script.sh
echo 'sudo echo "Sudo command successful."' >> /sudo_test_script.sh
chmod 755 /sudo_test_script.sh

echo '#!/bin/oopis_shell' > /sudo_reauth_test.sh
echo 'echo "Attempting to run sudo command after re-login..."' >> /sudo_reauth_test.sh
echo 'sudo echo "Sudo re-authentication successful."' >> /sudo_reauth_test.sh
chmod 755 /sudo_reauth_test.sh
delay 200

delay 500
login userDiag pantload
echo "Current User (expected: userDiag):"
whoami
echo "Current Path after login (expected: /home/userDiag):"
pwd
delay 400

# --- Phase 1.5: Inflate Diagnostic Assets ---
echo ""
echo "--- Phase: Creating diagnostic assets (scripts & data files) ---"
cd ./diag_workspace
run ./diag_assets.sh
echo "Asset creation complete."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 2: Parser/Lexer Robustness ---
echo ""
echo "===== Testing: Parser/Lexer Robustness (Quotes, Escapes, Errors) ====="
delay 400
echo "--- Test: Filenames with spaces (Quoting) ---"
mkdir "a directory with spaces"
ls -l
touch "a directory with spaces/a file with spaces.txt"
echo "Quoted content" > "a directory with spaces/a file with spaces.txt"
cat "a directory with spaces/a file with spaces.txt"
rm -r -f "a directory with spaces"
delay 300
echo "--- Test: Complex echo with mixed quotes and escapes ---"
echo 'A string with "double quotes" inside single quotes' > mixed_quotes.txt
cat mixed_quotes.txt
rm -f mixed_quotes.txt
delay 300
echo "---------------------------------------------------------------------"

# --- Phase 3: Core File System Commands ---
echo ""
echo "===== Testing: Core File System (mkdir, touch, ls, pwd, tree) ====="
delay 400
echo "--- Test: 'mkdir', 'pwd', 'cd', 'tree' ---"
mkdir -p level1/level2/level3
pwd
cd level1/level2
pwd
cd ../..
pwd
echo "--- Test: 'tree' command ---"
tree
tree -L 2
delay 300
echo "--- Test: 'touch' functionality and timestamp flags ---"
touch new_file.tst
ls -l new_file.tst
delay 1600
touch new_file.tst
ls -l new_file.tst
echo "--- NEW: Testing advanced 'touch -d' timestamp setting ---"
touch -d "1 year ago" old_file.tst
ls -l
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 4: File Content and Redirection ---
echo ""
echo "===== Testing: File Content (echo, cat, >, >>, |) ====="
delay 400
echo "--- Test: 'echo > file' (overwrite) & 'cat' ---"
echo "Hello OopisOS" > file_a.txt
cat file_a.txt
echo "--- Test: 'echo >> file' (append) ---"
echo "Appended line" >> file_a.txt
cat file_a.txt
echo "--- Test: Piping and complex commands ---"
cat file_a.txt | grep "Hello"
echo "--- NEW: Test 'cat -n' for line numbering ---"
cat -n file_a.txt
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 5: Advanced 'ls' Flags ---
echo ""
echo "===== Testing: Advanced 'ls' Flags ====="
mkdir ls_adv_dir
cd ls_adv_dir
touch file_c.txt
delay 100
touch file_z.log
delay 100
echo "smallest" > file_c.txt
echo "medium content here" > file_z.log
delay 1600
touch file_a.txt
echo "largest file content for size sort" > file_a.txt
delay 1600
touch file_b.md
echo "markdown" > file_b.md
mkdir sub_ls
touch sub_ls/nested.sh
touch .hidden_adv.txt
delay 400
echo "--- ls -l (long format) ---"
ls -l
echo "--- ls -a (all, including hidden) ---"
ls -a
echo "--- ls -t (sort by time, newest first) ---"
ls -t
echo "--- ls -S (sort by size, largest first) ---"
ls -S
echo "--- ls -X (sort by extension) ---"
ls -X
echo "--- ls -R (recursive) ---"
ls -R
cd ../
rm -r -f ls_adv_dir
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 6: Group Permissions and Ownership ---
echo ""
echo "===== Testing: Group Permissions (chgrp, usermod, groupadd) ====="
delay 400
login root mcgoopis
groupadd testgroup
useradd testuser
testpass
testpass
usermod -aG testgroup testuser
chmod 755 /home/userDiag
cd /home/userDiag/diag_workspace
echo "Initial content" > group_test_file.txt
chown userDiag group_test_file.txt
chgrp testgroup group_test_file.txt
chmod 664 group_test_file.txt
logout
login testuser
testpass
cd /home/userDiag/diag_workspace
echo "Append by group member" >> group_test_file.txt
cat group_test_file.txt
logout
login Guest
cd /home/userDiag/diag_workspace
check_fail "echo 'Append by other user' >> group_test_file.txt"
logout
login root mcgoopis
removeuser -f testuser
groupdel testgroup
rm -f /home/userDiag/diag_workspace/group_test_file.txt
chmod 700 /home/userDiag
logout
login userDiag pantload
cd /home/userDiag/diag_workspace
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 7: Interactive Command Prompts (rm, cp, mv) ---
echo ""
echo "===== Testing: Scripted Interactive Prompts (rm, cp, mv) ====="
delay 400
echo "--- Test: 'rm -i' (interactive remove) ---"
run ./test_rm_no.sh
ls interactive_file.txt
run ./test_rm_yes.sh
check_fail "ls interactive_file.txt"
delay 300
echo "--- Test: 'cp -i' (interactive copy) ---"
run ./test_cp_no.sh
cat interactive_target.txt
run ./test_cp_yes.sh
cat interactive_target.txt
delay 300
echo "--- Test: 'mv -i' (interactive move) ---"
run ./test_mv_no.sh
ls mv_source_2.txt
cat mv_target_2.txt
run ./test_mv_yes.sh
cat mv_target_2.txt
check_fail "ls mv_source_2.txt"
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 8: Alias and Environment Variables ---
echo ""
echo "===== Testing: Alias and Environment Variables ====="
delay 400
echo "--- Test: Alias commands ---"
alias l="ls"
alias la="ls -a"
alias
la
unalias l
check_fail "l"
unalias la
delay 300
echo "--- Test: Environment Variables (set, unset, expansion) ---"

echo "--- Test 1.1: Basic 'VAR value' syntax ---"
set TEST_VAR_1 "Hello OopisOS"
echo "Result -> TEST_VAR_1 is: '$TEST_VAR_1'"
echo "(Expected: 'Hello OopisOS')"
echo ""
delay 500

echo "--- Test 1.2: Basic 'VAR=value' syntax ---"
set TEST_VAR_2=HelloWorld
echo "Result -> TEST_VAR_2 is: '$TEST_VAR_2'"
echo "(Expected: 'HelloWorld')"
echo ""
delay 500

echo "--- Test 1.3: 'VAR = \"value\"' syntax ---"
set TEST_VAR_3 = "Spaces and quotes"
echo "Result -> TEST_VAR_3 is: '$TEST_VAR_3'"
echo "(Expected: 'Spaces and quotes')"
echo ""
delay 500

echo "--- Test 1.4: Overwriting a variable ---"
set TEST_VAR_1="Goodbye"
echo "Result -> TEST_VAR_1 is now: '$TEST_VAR_1'"
echo "(Expected: 'Goodbye')"
echo ""
delay 500

echo "--- Test 1.5: Unsetting variables ---"
unset TEST_VAR_1
unset TEST_VAR_2
echo "Result -> TEST_VAR_1 is now: '$TEST_VAR_1'"
echo "(Expected: '')"
echo ""
delay 500

echo "--- Test 1.6: Invalid variable names ---"
check_fail "set 1VAR=fail"
check_fail "set VAR-FAIL=fail"
echo ""
delay 500

echo "--- Test 1.7: Displaying final set of variables ---"
set
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 9: Advanced `find` Command ---
echo ""
echo "===== Testing: Advanced 'find' Command ====="
delay 400
echo "--- Find by name and type ---"
find . -name "*.sh"
find . -type d
echo "--- Find by user and permissions ---"
find . -user userDiag
ls -l exec_test.sh
find . -perm 600
echo "--- Find with -exec action ---"
find . -name "exec_test.sh" -exec chmod 755 {} \;
ls -l exec_test.sh
echo "--- Find with -delete action ---"
ls deleteme.tmp
find . -name "deleteme.tmp" -delete
check_fail "ls deleteme.tmp"
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 10: Advanced Scripting (`run`) ---
echo ""
echo "===== Testing: Advanced Scripting - 'run' Command with Arguments ====="
delay 400
run ./arg_test.sh first "second arg" third
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 11: Application Tests (paint, chidi) ---
echo ""
echo "===== Testing: Applications (paint, chidi) ====="
delay 400
echo "--- NOTE: 'paint' and 'chidi' are interactive graphical applications ---"
echo "--- and cannot be fully tested in a non-interactive script. ---"
echo "--- We will test that they correctly reject non-interactive execution. ---"
delay 300
check_fail "paint new_art.oopic"
check_fail "chidi ./chidi_test_docs"
echo "--- Application non-interactive checks passed. ---"
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 12: Globbing Expansion ---
echo ""
echo "===== Testing: Globbing Wildcard Expansion ====="
delay 400
echo "--- Test: Basic '*' glob for .sh files ---"
ls *.sh
delay 300
echo "--- Test: Path-prefixed './*.txt' glob ---"
ls ./*.txt
delay 300
echo "--- Test: Subdirectory glob 'chidi_test_docs/*.md' ---"
ls chidi_test_docs/*.md
delay 300
echo "--- Test: Question mark '?' glob 'test_??_yes.sh' ---"
ls test_??_yes.sh
delay 300
echo "--- Test: No-match glob should pass literal to command and fail ---"
check_fail "ls *.nonexistent"
delay 300
echo "--- Test: Non-whitelisted command 'echo' should NOT expand glob ---"
echo *.txt
delay 700
echo "---------------------------------------------------------------------"

# --- NEW: Phase 13: Data Processing Utilities ---
echo ""
echo "===== NEW: Testing Data Processing (head, tail, wc, sort, uniq, awk, xargs) ====="
delay 400
echo "--- 'wc' (word count) ---"
wc data_stream.txt
echo "--- 'head' and 'tail' ---"
head -n 3 data_stream.txt
tail -n 2 data_stream.txt
echo "--- 'sort' and 'uniq' ---"
sort data_stream.txt
sort data_stream.txt | uniq
sort data_stream.txt | uniq -c
sort -n data_stream.txt
echo "--- 'awk' ---"
awk '{print "Line " NR ": " $0}' data_stream.txt
ls -l | awk '{print $9, $5}'
echo "--- 'xargs' ---"
cat files_to_process.txt | xargs wc -l
delay 700
echo "---------------------------------------------------------------------"

# --- NEW: Phase 14: Archival Utilities ---
echo ""
echo "===== NEW: Testing Archival (zip, unzip) ====="
delay 400
echo "--- 'zip' ---"
zip test_archive.zip ./archive_this
ls -l test_archive.zip
cat test_archive.zip
echo "--- 'unzip' ---"
mkdir extract_here
unzip test_archive.zip ./extract_here
tree ./extract_here
echo "Verifying unzipped content..."
cat ./extract_here/archive_this/nested_dir/file2.txt
delay 700
echo "---------------------------------------------------------------------"

# --- NEW: Phase 15: Disk Utilities ---
echo ""
echo "===== NEW: Testing Disk Utilities (df, du) ====="
delay 400
echo "--- 'df' (disk free) ---"
df
df -h
echo "--- 'du' (disk usage) ---"
du -h ./archive_this
du -sh .
delay 700
echo "---------------------------------------------------------------------"

# --- NEW: Phase 16: Backup & Restore Checks ---
echo ""
echo "===== NEW: Testing Backup & Restore ====="
delay 400
echo "--- 'backup' command ---"
echo "NOTE: 'backup' is interactive and will trigger a browser download."
echo "We can only test that the command initiates without error."
backup
delay 300
echo "--- 'restore' command ---"
echo "NOTE: 'restore' is interactive and destructive."
echo "We will only test that it fails correctly in a non-interactive script."
check_fail "restore"
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 17: Final Cleanup ---
echo ""
echo "--- Final Cleanup ---"
cd /
login root mcgoopis
delay 300
rm -r -f /home/userDiag/diag_workspace
rm -f /sudo_test_script.sh /sudo_reauth_test.sh
login Guest
echo "Final user list (expected: Guest, root, userDiag):"
listusers
delay 700
echo "---------------------------------------------------------------------"
echo ""
echo "      ===== OopisOS Core Test Suite v3.2 Complete ======="
echo " "
delay 500
echo "  ======================================================"
delay 150
echo "  ==                                                  =="
delay 150
echo "  ==           OopisOS Core Diagnostics               =="
delay 150
echo "  ==            ALL SYSTEMS OPERATIONAL               =="
delay 200
echo "  ==                                                  =="
delay 150
echo "  ======================================================"
echo " "
delay 500
echo "(As usual, you've been a real pantload!)"
delay 200