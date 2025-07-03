# OopisOS Core Test Suite v3.5 - "The Gauntlet, Reforged and Patched"
echo "===== OopisOS Core Test Suite v3.5 Initializing ====="
echo "This script tests all non-interactive core functionality, now with more paranoia."
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
mkdir -p src mv_test_dir overwrite_dir find_test/subdir zip_test/nested_dir "a dir with spaces"
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
# ls sorting assets
touch -d "2 days ago" old.ext
touch -d "1 day ago" new.txt
echo "short" > small.log
echo "this is a very long line" > large.log
echo "Asset creation complete."
delay 700
echo "---------------------------------------------------------------------"

# --- Phase 2: Core FS Commands & Flags (Expanded) ---
echo ""
echo "===== Phase 2: Testing Core FS Commands (Expanded) ====="
delay 400
echo "--- Test: diff, cp -p, mv ---"
diff diff_a.txt diff_b.txt
cp -p exec_test.sh exec_test_copy.sh
ls -l exec_test.sh exec_test_copy.sh
mv exec_test_copy.sh mv_test_dir/
ls mv_test_dir/
echo "--- Test: touch -d and -t ---"
touch -d "1 day ago" old_file.txt
touch -t 202305201200.30 specific_time.txt
ls -l old_file.txt specific_time.txt
echo "--- Test: ls sorting flags (-t, -S, -X, -r) ---"
echo "Sorting by modification time (newest first):"
ls -lt
echo "Sorting by size (largest first):"
ls -lS
echo "Sorting by extension:"
ls -lX
echo "Sorting by name in reverse order:"
ls -lr
echo "--- Test: cat -n ---"
cat -n diff_a.txt
delay 700
echo "---------------------------------------------------------------------"


# --- Phase 3: Group Permissions and Ownership (Expanded) ---
echo ""
echo "===== Phase 3: Testing Group Permissions & Ownership (Expanded) ====="
delay 400
login root mcgoopis
groupadd testgroup
useradd testuser
testpass
testpass
usermod -aG testgroup testuser
groups testuser
# Create the directory for the cd permission test as root
mkdir -p /tmp/no_exec_dir
chmod 644 /tmp/no_exec_dir
# Set up the group test file as root
chmod 755 /home/diagUser # Allow testuser to cd into diagUser home
cd /home/diagUser/diag_workspace
echo "Initial content" > group_test_file.txt
chown diagUser group_test_file.txt
chgrp testgroup group_test_file.txt
chmod 664 group_test_file.txt
echo "--- Test: Group write permission ---"
login testuser testpass
cd /home/diagUser/diag_workspace
echo "Append by group member" >> group_test_file.txt
cat group_test_file.txt
echo "--- Test: 'Other' permissions (should fail) ---"
login Guest
cd /home/diagUser/diag_workspace
check_fail "echo 'Append by other user' >> group_test_file.txt"
echo "--- Test: Permission Edge Cases ---"
login testuser testpass
check_fail "chmod 777 /home/diagUser/diag_workspace/group_test_file.txt" # testuser is not owner
check_fail "cd /tmp/no_exec_dir" # testuser cannot execute
login root mcgoopis
rm -r -f /tmp
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

# --- Phase 7.5: Pager and Calculator Tests ---
echo ""
echo "===== Phase 7.5: Testing Pager (more/less) and Calculator (bc) ====="
delay 400
echo "--- Test: bc command (pipe and argument) ---"
echo "5 * (10 - 2) / 4" | bc
bc "100 + 1"
check_fail "bc '5 / 0'"
echo "--- Test: Pager integration (non-interactive) ---"
echo "This test verifies 'more' and 'less' pass data through in scripts."
echo -e "Line 1\nLine 2\nLine 3" > pager_test.txt
cat pager_test.txt | more | wc -l
cat pager_test.txt | less | wc -l
echo "Pager pass-through test complete."
rm pager_test.txt
delay 700
echo "---------------------------------------------------------------------"

# --- NEW TEST PHASE ---
echo ""
echo "===== Phase 7.6: Testing Data Transformation & Integrity Commands ====="
delay 400
echo "--- Test: rmdir ---"
mkdir empty_dir
rmdir empty_dir
check_fail "ls empty_dir"
mkdir non_empty_dir; touch non_empty_dir/file.txt
check_fail "rmdir non_empty_dir"
rm -r non_empty_dir
echo "rmdir tests complete."
delay 400
echo "--- Test: base64 (encode/decode) ---"
echo "The Tao is eternal." > b64_test.txt
base64 b64_test.txt > b64_encoded.txt
base64 -d b64_encoded.txt
rm b64_test.txt b64_encoded.txt
echo "base64 tests complete."
delay 400
echo "--- Test: ocrypt (encrypt/decrypt) ---"
echo "Harmony and order." > ocrypt_test.txt
ocrypt diag_pass ocrypt_test.txt > ocrypt_encrypted.txt
ocrypt diag_pass ocrypt_encrypted.txt
rm ocrypt_test.txt ocrypt_encrypted.txt
echo "ocrypt tests complete."
delay 400
echo "--- Test: cksum and sync ---"
echo "A well-written program is its own Heaven." > cksum_test.txt
cksum cksum_test.txt
sync
echo "A poorly-written program is its own Hell." >> cksum_test.txt
cksum cksum_test.txt
rm cksum_test.txt
echo "cksum and sync tests complete."
delay 400
echo "--- Test: csplit ---"
echo -e "alpha\nbravo\ncharlie\ndelta\necho" > csplit_test.txt
csplit csplit_test.txt 3
ls xx*
rm -f xx00 xx01 csplit_test.txt
echo "csplit test complete."
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

# --- Phase 9: Edge Case Gauntlet (Expanded) ---
echo ""
echo "===== Phase 9: Testing Edge Cases & Complex Scenarios (Expanded) ====="
delay 400

echo "--- Test: Filenames with spaces ---"
mkdir "my test dir"
echo "hello space" > "my test dir/file with spaces.txt"
ls "my test dir"
cat "my test dir/file with spaces.txt"
mv "my test dir" "your test dir"
ls "your test dir"
rm -r "your test dir"
check_fail "ls 'my test dir'"
echo "Space filename tests complete."
delay 400

echo "--- Test: Advanced find commands (-exec, -delete, operators) ---"
mkdir -p find_exec_test/subdir
touch find_exec_test/file.exec
touch find_exec_test/subdir/another.exec
touch find_exec_test/file.noexec
# Test -exec to change permissions
find ./find_exec_test -name "*.exec" -exec chmod 777 {} \;
ls -l find_exec_test/
ls -l find_exec_test/subdir/
# Test -delete and -o (OR)
find ./find_exec_test -name "*.noexec" -o -name "another.exec" -delete
ls -R find_exec_test
rm -r find_exec_test
echo "Advanced find tests complete."
delay 400

echo "--- Test: Complex pipes and append redirection (>>) ---"
echo -e "apple\nbanana\norange\napple" > fruit.txt
cat fruit.txt | grep "a" | sort | uniq -c > fruit_report.txt
echo "--- Initial Report ---"
cat fruit_report.txt
echo "One more apple" >> fruit_report.txt
echo "--- Appended Report ---"
cat fruit_report.txt
rm fruit.txt fruit_report.txt
echo "Piping and redirection tests complete."
delay 400

echo "--- Test: Logical OR (||) and interactive flags ---"
check_fail "cat nonexistent_file.txt" || echo "Logical OR successful: cat failed as expected."
echo "YES" > yes.txt # CHANGED from "y" to "YES"
echo "n" > no.txt
touch interactive_test.txt
# The script runner will auto-reply 'YES' to prompts
# This tests the `rm -i` prompt flow.
rm -i interactive_test.txt < yes.txt
check_fail "ls interactive_test.txt"
# This tests the `cp -i` prompt flow.
touch another_file.txt
cp -i another_file.txt overwrite_dir < yes.txt
ls overwrite_dir
# This tests forced overwrite with `cp -f`
cp -f another_file.txt overwrite_dir
rm no.txt yes.txt another_file.txt
echo "Interactive flag and logical OR tests complete."
delay 700

echo "---------------------------------------------------------------------"

# --- Phase 10: Final Cleanup ---
echo ""
echo "--- Phase 10: Final Cleanup ---"
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
echo "      ===== OopisOS Core Test Suite v3.5 Complete ======="
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