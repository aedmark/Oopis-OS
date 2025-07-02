# diag_assets.sh - v3.3 - Creates files needed for the enhanced diagnostic suite.

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
echo "--- NEW: Creating assets for archival, data processing, and disk usage tests ---"
# For zip/unzip tests
mkdir -p archive_this/nested_dir
echo "file one" > archive_this/file1.txt
echo "file two" > archive_this/nested_dir/file2.txt
chmod 600 archive_this/nested_dir/file2.txt

# For head, tail, sort, uniq, wc, awk, and xargs tests
echo "alpha" > data_stream.txt
echo "gamma" >> data_stream.txt
echo "beta" >> data_stream.txt
echo "delta" >> data_stream.txt
echo "gamma" >> data_stream.txt
echo "100" >> data_stream.txt
echo "50" >> data_stream.txt
echo "200" >> data_stream.txt

# For xargs test
echo "data_stream.txt" > files_to_process.txt
echo "archive_this/file1.txt" >> files_to_process.txt