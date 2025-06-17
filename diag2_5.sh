# OopisOS Non-Interactive Core Functionality Test Script
# Script Version 2.5 (Interactive Scripting & Adventure Test Phase Added)

echo "===== OopisOS Core Test Suite Initializing (v2.5) ====="
echo "This script tests non-interactive core functionality, including"
echo "scripted interactive prompts and the adventure game engine."
echo "---------------------------------------------------------------------"
echo ""

# --- Phase 1: Login and Workspace Preparation ---
echo "--- Phase: Logging in as 'root' and Preparing Workspace ---"
login root mcgoopis
delay 400
mkdir /home/userDiag/diag_workspace/
chown userDiag /home/userDiag/diag_workspace/
cp /home/Guest/diag_assets.sh /home/userDiag/diag_workspace/diag_assets.sh
# ADD THESE TWO LINES
chown userDiag /home/userDiag/diag_workspace/diag_assets.sh
chmod 700 /home/userDiag/diag_workspace/diag_assets.sh
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
# This script creates all the helper files needed for later tests.
# Make sure diag_assets.sh is uploaded to the root directory.
cd ./diag_workspace
run ./diag_assets.sh
echo "Asset creation complete."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 2: Parser/Lexer Robustness ---
echo ""
echo "===== Testing: Parser/Lexer Robustness (Quotes, Escapes, Errors) ====="
delay 400

echo "--- Test: Redirection with invalid/empty targets ---"
check_fail "echo 'test' > ''"
check_fail "echo 'test' >"
check_fail "echo 'test' >> ''"
check_fail "echo 'test' >>"
check_fail ">"
check_fail ">>"
check_fail "> |"
delay 300

echo "--- Test: Filenames with spaces (Quoting) ---"
mkdir "a directory with spaces"
ls -l
touch "a directory with spaces/a file with spaces.txt"
ls "a directory with spaces"
echo "Quoted content" > "a directory with spaces/a file with spaces.txt"
cat "a directory with spaces/a file with spaces.txt"
rm -r -f "a directory with spaces"
delay 300

echo "--- Test: Filenames with escaped characters ---"
mkdir my\ test\ dir
ls
echo "Escaped content" > my\ test\ dir/escaped\ file.log
cat my\ test\ dir/escaped\ file.log
rm -r -f my\ test\ dir
delay 300

echo "--- Test: Complex echo with mixed quotes and escapes ---"
echo 'A string with "double quotes" inside single quotes' > mixed_quotes.txt
cat mixed_quotes.txt
echo "A string with 'single quotes' and an escaped \"double quote\"." >> mixed_quotes.txt
cat mixed_quotes.txt
rm -f mixed_quotes.txt
delay 300

echo "--- Test: Graceful handling of empty/multi-semicolon commands ---"
echo "Part 1";; echo "Part 2"
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 3: Core File System Commands ---
echo ""
echo "===== Testing: Core File System (mkdir, touch, ls, pwd) ====="
delay 400

echo "--- Test: 'mkdir' basic, nested, and error cases ---"
mkdir my_dir
mkdir -p level1/level2/level3
ls -l .
ls -l level1
tree level1
delay 300
touch existing_file.txt
check_fail "mkdir existing_file.txt"
rm -f existing_file.txt; delay 300
mkdir existing_dir
check_fail "mkdir existing_dir"
rm -r -f existing_dir; delay 300
echo "file_content" > intermediate_file.txt
check_fail "mkdir -p intermediate_file.txt/new_dir"
rm -f intermediate_file.txt
delay 700

echo "--- Test: 'touch' functionality ---"
touch new_file.txt; ls -l new_file.txt
delay 1600;
touch new_file.txt; ls -l new_file.txt
delay 700

echo "--- Test: 'ls' basic, hidden files, and errors ---"
mkdir empty_ls_dir; ls empty_ls_dir; rm -r -f empty_ls_dir
touch .hidden_file; mkdir .hidden_dir; ls; ls -a; rm -f .hidden_file; rm -r -f .hidden_dir
check_fail "ls non_existent_ls_dir"
delay 700

echo "--- Test: 'pwd' and 'cd' navigation & permissions ---"
pwd
cd level1/level2; pwd
cd ../..; pwd
touch file_for_cd_error.txt; check_fail "cd file_for_cd_error.txt"; rm -f file_for_cd_error.txt
mkdir no_exec_dir_cd; chmod 600 no_exec_dir_cd; check_fail "cd no_exec_dir_cd"; chmod 700 no_exec_dir_cd; rm -r -f no_exec_dir_cd
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 4: File Content and Redirection ---
echo ""
echo "===== Testing: File Content (echo, cat, >, >>, |) ====="
delay 400

echo "--- Test: 'echo > file' (overwrite) & 'cat' ---"
echo "Hello OopisOS" > file_a.txt; cat file_a.txt
echo "New Content" > file_a.txt; cat file_a.txt
delay 400

echo "--- Test: 'echo >> file' (append) ---"
echo "Initial line" > file_b.txt; cat file_b.txt
echo "Appended line" >> file_b.txt; cat file_b.txt
delay 400

echo "--- Test: Piping and complex commands ---"
echo "Piped content" | cat
echo "L1\nL2\nL3\nL2" > pipe_src.txt
cat pipe_src.txt | grep "L2"
cat pipe_src.txt | grep "L3" > pipe_out.txt; cat pipe_out.txt; rm -f pipe_out.txt
rm -f pipe_src.txt
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 5: Advanced 'ls' Flags ---
echo ""
echo "===== Testing: Advanced 'ls' Flags ====="
mkdir ls_adv_dir; cd ls_adv_dir
touch file_c.txt; delay 100; touch file_z.log; delay 100
echo "smallest" > file_c.txt
echo "medium content here" > file_z.log
delay 1600; touch file_a.txt; echo "largest file content for size sort" > file_a.txt
delay 1600; touch file_b.md; echo "markdown" > file_b.md
mkdir sub_ls; touch sub_ls/nested.sh;
touch .hidden_adv.txt
delay 400
echo "--- ls -l (long format) ---"; ls -l
echo "--- ls -a (all, including hidden) ---"; ls -a
echo "--- ls -t (sort by time, newest first) ---"; ls -t
echo "--- ls -S (sort by size, largest first) ---"; ls -S
echo "--- ls -X (sort by extension) ---"; ls -X
echo "--- ls -R (recursive) ---"; ls -R
cd ../
rm -r -f ls_adv_dir
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 6: Group Permissions and Ownership ---
echo ""
echo "===== Testing: Group Permissions (chgrp, usermod, groupadd) ====="
delay 400

# --- 1. SETUP AS ROOT ---
login root mcgoopis
groupadd testgroup
useradd testuser
testpass
testpass
usermod -aG testgroup testuser

# Now, set up the test file and ALL permissions at once
cd /home/userDiag/diag_workspace
echo "Initial content" > group_test_file.txt
chown userDiag group_test_file.txt
chgrp testgroup group_test_file.txt
chmod 664 group_test_file.txt

# And set the required directory permissions
chmod 755 /home/userDiag
chgrp testgroup /home/userDiag/diag_workspace
chmod 775 /home/userDiag/diag_workspace
logout

# --- 2. TEST AS TESTUSER ---
# Use the interactive prompt feature we just fixed!
login testuser
testpass
cd /home/userDiag/diag_workspace
echo "Append by group member" >> group_test_file.txt
cat group_test_file.txt
logout

# --- 3. TEST AS GUEST (should fail to write) ---
login Guest
cd /home/userDiag/diag_workspace
check_fail "echo 'Append by other user' >> group_test_file.txt"
logout

# --- 4. CLEANUP AS ROOT ---
login root mcgoopis
removeuser -f testuser
groupdel testgroup
rm -f /home/userDiag/diag_workspace/group_test_file.txt
logout

# --- 5. Return to userDiag for the next phase ---
login userDiag pantload
cd /home/userDiag/diag_workspace
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 7: NEW - Interactive Command Prompts ---
echo ""
echo "===== Testing: Scripted Interactive Prompts (rm, cp, mv) ====="
delay 400
echo "--- Test: 'rm -i' (interactive remove) ---"
echo "Testing 'rm -i' with 'no' response..."
run ./test_rm_no.sh
ls interactive_file.txt
echo "Testing 'rm -i' with 'YES' response..."
run ./test_rm_yes.sh
check_fail "ls interactive_file.txt"
delay 300
echo "--- Test: 'cp -i' (interactive copy) ---"
echo "Testing 'cp -i' with 'no' response to overwrite..."
run ./test_cp_no.sh
cat interactive_target.txt
echo "Testing 'cp -i' with 'YES' response to overwrite..."
run ./test_cp_yes.sh
cat interactive_target.txt
delay 300
echo "--- Test: 'mv -i' (interactive move) ---"
echo "Testing 'mv -i' with 'no' response to overwrite..."
run ./test_mv_no.sh
ls mv_source_2.txt
cat mv_target_2.txt
echo "Testing 'mv -i' with 'YES' response to overwrite..."
run ./test_mv_yes.sh
cat mv_target_2.txt
check_fail "ls mv_source_2.txt"
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 8: Core Utilities (rm, cp, mv) ---
echo ""
echo "===== Testing: rm, cp, mv (Non-interactive) ====="
echo "--- Test: 'rm -rf' on a directory with contents ---"
mkdir rm_dir_r; touch rm_dir_r/f1; rm -r -f rm_dir_r; check_fail "ls rm_dir_r"
delay 300
echo "--- Test: 'cp -r' directory ---"
mkdir cp_S; touch cp_S/s_file.txt; cp -r cp_S cp_S_copy; tree cp_S_copy
delay 300
echo "--- Test: 'mv' file and directory ---"
mv cp_S/s_file.txt .
ls s_file.txt
mv cp_S cp_D
ls cp_D
delay 300
rm -r -f s_file.txt cp_S_copy cp_D
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 9: Alias and Unalias Commands ---
echo ""
echo "===== Testing: Alias and Unalias Commands ====="
delay 400
alias l="ls"
alias la="ls -a"
alias
la
unalias l
check_fail "l"
unalias la
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 10: 'find' command ---
echo ""
echo "===== Testing: 'find' Command ====="
mkdir find_root; cd find_root
touch fileA.txt fileB.log
mkdir dir1
find . -name "*.txt"
find . -type d
cd ..; rm -r -f find_root
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 11: Scripting (`run`) ---
echo ""
echo "===== Testing: Scripting - 'run' Command ====="
echo "echo \"Basic script ran\"" > run_basic.sh;
chmod 700 run_basic.sh;
run ./run_basic.sh
rm -f run_basic.sh
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 12: Background Processes & Job Control ---
echo ""
echo "===== Testing: Background Processes (&, ps, kill) ====="
delay 5000 &
delay 100
ps
kill 1
delay 100
ps
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 13: File Comparison (`diff`) ---
echo ""
echo "===== Testing: 'diff' Command ====="
echo "a" > d1.txt; echo "b" > d2.txt
diff d1.txt d2.txt
rm d1.txt d2.txt
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 14: Network Utilities ---
echo ""
echo "===== Testing: Network Utilities (wget, curl) ====="
wget https://raw.githubusercontent.com/aedmark/Oopis-OS/refs/heads/master/LICENSE.txt
ls LICENSE.txt
rm LICENSE.txt
curl https://api.github.com/zen
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 15: NEW - Adventure Game Engine ---
echo ""
echo "===== Testing: Adventure Game Engine (Scripted) ====="
delay 400
echo "--- Test 1: Launch and immediately quit custom game ---"
run ./adv_test1.sh
delay 300
echo "--- Test 2: Basic gameplay sequence ---"
run ./adv_test2.sh
delay 300
echo "--- Test 3: Saving game state ---"
run ./adv_test3.sh
echo "Verifying save file was created:"
ls my_save.sav
delay 300
echo "--- Test 4: Loading game state and verifying ---"
run ./adv_test4.sh
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 16: Final Cleanup ---
echo ""
echo "--- Final Cleanup ---"
cd /
login root mcgoopis
delay 300
rm -r -f /home/userDiag/diag_workspace
logout
echo "Final user list (expected: Guest, root, userDiag):"
listusers
delay 700
echo "---------------------------------------------------------------------"
echo ""
echo "===== OopisOS Core Test Suite Complete (v2.4) ======="
echo " "
delay 500
echo "  ======================================================"
delay 150
echo "  ==                                                  =="
delay 150
echo "  ==      OopisOS Core Diagnostics - v2.4             =="
delay 150
echo "  ==              CONGRATULATIONS,                    =="
delay 150
echo "  ==            ALL SYSTEMS ARE GO!                   =="
delay 200
echo "  ==                                                  =="
echo "  ==   (As usual, you've been a real pantload!)       =="
echo "  ==                                                  =="
delay 150
echo "  ======================================================"
echo " "
delay 500
echo "...kthxbye"