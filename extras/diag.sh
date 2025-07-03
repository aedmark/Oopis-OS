# OopisOS Core Test Suite v3.6 - "The Ultimate Gauntlet" (Self-Contained)
echo "===== OopisOS Core Test Suite v3.6 Initializing ====="
echo "This script tests all non-interactive core functionality."
echo "---------------------------------------------------------------------"
echo ""

# --- Phase 1: Test User & Workspace Setup ---
echo "--- Phase 1: Creating dedicated test user and workspace ---"
login root mcgoopis
delay 400
useradd diagUser
testpass
testpass
mkdir -p /home/diagUser/diag_workspace/
chown diagUser /home/diagUser/diag_workspace/
delay 500
login diagUser testpass
echo "Current User (expected: diagUser):"
whoami
echo "Current Path after login (expected: /home/diagUser):"
pwd
cd /home/diagUser/diag_workspace
delay 400
echo "---------------------------------------------------------------------"

# --- Phase 1.5: Create All Diagnostic Assets ---
echo ""
echo "--- Phase 1.5: Creating diagnostic assets ---"
# Basic FS assets
mkdir -p src mv_test_dir overwrite_dir find_test/subdir zip_test/nested_dir
# Text/diff assets
echo -e "line one\nline two\nline three" > diff_a.txt
echo -e "line one\nline 2\nline three" > diff_b.txt
# Permissions assets
echo "I should not be executable" > exec_test.sh; chmod 600 exec_test.sh
touch preserve_perms.txt; chmod 700 preserve_perms.txt
# Data processing assets
echo -e "zeta\nalpha\nbeta\nalpha\n10\n2" > sort_test.txt
echo "The quick brown fox." > text_file.txt
# xargs assets
touch file1.tmp file2.tmp file3.tmp
# find assets
touch find_test/a.txt find_test/b.tmp find_test/subdir/c.tmp
chmod 777 find_test/a.txt
# zip assets
echo "file one content" > zip_test/file1.txt
echo "nested file content" > zip_test/nested_dir/file2.txt
# Scripting assets
echo '#!/bin/oopis_shell' > arg_test.sh
echo 'echo "Arg 1: $1, Arg 2: $2, Arg Count: $#, All Args: $@" ' >> arg_test.sh
chmod 700 arg_test.sh
echo '#!/bin/oopis_shell' > infinite_loop.sh
echo 'run ./infinite_loop.sh' >> infinite_loop.sh
chmod 700 infinite_loop.sh
echo "Asset creation complete."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 2: Core FS Commands & Flags ---
echo ""
echo "===== Phase 2: Testing Core FS Commands ====="
delay 400
echo "--- Test: diff, cp -p, mv ---"
diff diff_a.txt diff_b.txt
cp -p exec_test.sh exec_test_copy.sh
ls -l exec_test.sh exec_test_copy.sh
mv exec_test_copy.sh mv_test_dir/
ls mv_test_dir/
echo "--- Test: touch -d ---"
touch -d "1 day ago" old_file.txt
ls -l old_file.txt
echo "--- Test: cat -n ---"
cat -n diff_a.txt
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 3: Group Permissions and Ownership ---
echo ""
echo "===== Phase 3: Testing Group Permissions & Ownership ====="
delay 400
login root mcgoopis
groupadd testgroup
useradd testuser
testpass
testpass
usermod -aG testgroup testuser
groups testuser
chmod 755 /home/diagUser
cd /home/diagUser/diag_workspace
echo "Initial content" > group_test_file.txt
chown diagUser group_test_file.txt
chgrp testgroup group_test_file.txt
chmod 664 group_test_file.txt
login testuser testpass
cd /home/diagUser/diag_workspace
echo "Append by group member" >> group_test_file.txt
cat group_test_file.txt
login Guest
cd /home/diagUser/diag_workspace
check_fail "echo 'Append by other user' >> group_test_file.txt"
login root mcgoopis
removeuser -f testuser
groupdel testgroup
rm -f /home/diagUser/diag_workspace/group_test_file.txt
chmod 700 /home/diagUser
login diagUser testpass
cd /home/diagUser/diag_workspace
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 4: Sudo & Security Model ---
echo ""
echo "===== Phase 4: Testing Sudo & Security Model ====="
delay 400
login root mcgoopis
useradd sudouser
testpass
testpass
echo "sudouser ALL" >> /etc/sudoers
login sudouser testpass
echo "Attempting first sudo command (password required)..."
sudo echo "Sudo command successful."
testpass
echo "Attempting second sudo command (should not require password)..."
sudo ls /home/root
login Guest
check_fail "sudo ls /home/root"
login root mcgoopis
removeuser -f sudouser
grep -v "sudouser" /etc/sudoers > sudoers.tmp; mv sudoers.tmp /etc/sudoers
login diagUser testpass
cd /home/diagUser/diag_workspace
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 5: Advanced Scripting & Process Management ---
echo ""
echo "===== Phase 5: Testing Scripting & Process Management ====="
delay 400
echo "--- Test: Script argument passing ---"
run ./arg_test.sh first "second arg" third
echo "--- Test: Script execution governor (expect graceful failure) ---"
check_fail "run ./infinite_loop.sh"
echo "--- Test: Background jobs (ps, kill) ---"
delay 5000 &
ps
ps | grep delay | awk '{print $1}' | xargs kill
ps
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 6: Advanced Data Processing & Text Utilities ---
echo ""
echo "===== Phase 6: Testing Data Processing & Text Utilities ======="
delay 400
echo "--- Test: sort (-n, -r, -u) ---"
sort -r sort_test.txt
sort -n sort_test.txt
sort -u sort_test.txt
echo "--- Test: wc (-l, -w, -c) ---"
wc text_file.txt
wc -l -w -c text_file.txt
echo "--- Test: head/tail (-n, -c) ---"
head -n 1 text_file.txt
tail -c 5 text_file.txt
echo "--- Test: grep flags (-i, -v, -c) ---"
grep -i "FOX" text_file.txt
grep -c "quick" text_file.txt
grep -v "cat" text_file.txt
echo "--- Test: xargs and pipe awareness ---"
ls -1 *.tmp | xargs rm
check_fail "ls file1.tmp"
echo "xargs deletion verified."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 7: find and Archival Commands ---
echo ""
echo "===== Phase 7: Testing 'find' and Archival (zip/unzip) ====="
delay 400
echo "--- Test: find by name, type, and permissions ---"
find find_test -name "*.tmp"
find find_test -type d
find find_test -perm 777
echo "--- Test: zip/unzip ---"
zip my_archive.zip ./zip_test
rm -r -f zip_test
unzip my_archive.zip .
ls -R zip_test
delay 700
echo "---------------------------------------------------------------------"


# --- Phase 8: Shell & Session Commands ---
echo ""
echo "===== Phase 8: Testing Shell & Session Commands ====="
delay 400
echo "--- Test: date ---"
date
echo "--- Test: df -h ---"
df -h
echo "--- Test: du -s ---"
du -s .
echo "--- Test: history -c ---"
history
history -c
history
echo "--- Test: alias/unalias ---"
alias myls="ls -l"
myls
unalias myls
check_fail "myls"
echo "--- Test: set/unset ---"
set MY_VAR="Variable Test Passed"
echo $MY_VAR
unset MY_VAR
echo $MY_VAR
echo "--- Test: printscreen ---"
printscreen screen.log
cat screen.log
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 9: Final Cleanup ---
echo ""
echo "--- Phase 9: Final Cleanup ---"
cd /
login root mcgoopis
delay 300
rm -r -f /home/diagUser
rm -r -f /home/sudouser
rm -r -f /home/testuser
login Guest
echo "Final user list:"
listusers
delay 700
echo "---------------------------------------------------------------------"
echo ""
echo "      ===== OopisOS Core Test Suite v3.6 Complete ======="
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