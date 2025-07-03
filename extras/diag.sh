#!/bin/oopis_shell
# OopisOS Core Test Suite v3.4 - "The Engineer's Gauntlet"
echo "===== OopisOS Core Test Suite v3.4 Initializing ====="
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
cd ./diag_workspace
run ./diag_assets.sh
echo "Asset creation complete."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 2: Parser/Lexer Robustness ---
echo ""
echo "===== Testing: Parser/Lexer Robustness (Quotes, Escapes, Errors) ====="
# (No changes here, this section was already solid)
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


# --- Phase 3: RIGOROUS File System Commands ---
echo ""
echo "===== Testing: Rigorous File System Ops (cp, mv, diff) ====="
delay 400
echo "--- Test: diff ---"
diff diff_a.txt diff_b.txt
echo "--- Test: cp -p (preserve permissions) ---"
ls -l preserve_perms.txt
cp -p preserve_perms.txt preserved_copy.txt
ls -l preserved_copy.txt
echo "--- Test: mv (move to directory) ---"
mkdir mv_test_dir
mv preserved_copy.txt mv_test_dir/
ls mv_test_dir/
echo "--- Test: Cross-type overwrite failures (The real test) ---"
mkdir overwrite_dir
touch overwrite_file.txt
check_fail "cp overwrite_file.txt overwrite_dir"
check_fail "mv overwrite_file.txt overwrite_dir"
delay 700
echo "---------------------------------------------------------------------"


# --- Phase 4: Group Permissions and Ownership ---
echo ""
echo "===== Testing: Group Permissions (chgrp, usermod, groupadd) ====="
# (No changes here, this section was already solid)
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

# --- Phase 5: Sudo & Security Model ---
echo ""
echo "===== Testing: Sudo & Security Model ====="
delay 400
echo "--- Test: visudo and sudoers modification ---"
login root mcgoopis
echo "sudouser ALL" >> /etc/sudoers
echo "--- Test: Successful sudo by authorized user ---"
login sudouser
testpass
testpass
sudo echo "Sudo command successful."
echo "--- Test: sudo re-authentication (no password needed) ---"
sudo ls /root
echo "--- Test: sudo re-authentication after logout (password needed) ---"
logout
login sudouser
testpass
sudo ls /root
testpass
echo "--- Test: Failed sudo by unauthorized user ---"
logout
login Guest
check_fail "sudo ls /root"
# Cleanup
logout
login root mcgoopis
removeuser -f sudouser
# A simple way to remove the last line of the file
head -n -1 /etc/sudoers > sudoers.tmp; mv sudoers.tmp /etc/sudoers
logout
login userDiag pantload
cd /home/userDiag/diag_workspace
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 6: Advanced Scripting & Governor ---
echo ""
echo "===== Testing: Advanced Scripting & Governor ====="
delay 400
echo "--- Test: Script argument passing ---"
run ./arg_test.sh first "second arg" third
echo "--- Test: Script execution governor (expect graceful failure) ---"
run ./infinite_loop.sh
delay 700
echo "---------------------------------------------------------------------"


# --- Phase 7: Advanced Data Processing ---
echo ""
echo "===== Testing: Advanced Data Processing (awk, xargs) ====="
delay 400
echo "--- Test: awk with BEGIN block ---"
awk 'BEGIN { print "--- Report ---" } { print $0 }' data_stream.txt
echo "--- Test: Destructive xargs operation ---"
ls *.tmp
ls *.tmp | xargs rm
check_fail "ls file1.tmp"
echo "xargs deletion verified."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 8: Final Cleanup ---
echo ""
echo "--- Final Cleanup ---"
cd /
login root mcgoopis
delay 300
rm -r -f /home/userDiag/diag_workspace
login Guest
echo "Final user list:"
listusers
delay 700
echo "---------------------------------------------------------------------"
echo ""
echo "      ===== OopisOS Core Test Suite v3.4 Complete ======="
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