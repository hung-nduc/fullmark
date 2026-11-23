# fullmark: Tab completion for `quiz` and `fullmark` in fish. Add this line to ~/.config/fish/config.fish:
#   quiz shell-init fish | source
# Each Tab runs `quiz __complete WORDS...`: one candidate per line (value, a tab, a description), then a directive line.
function __fullmark_complete
    set -l tokens (commandline -opc)
    set -l program $tokens[1]
    set -e tokens[1]
    set -l current (commandline -ct)
    # "$current" keeps the word being completed when it is empty (after a space)
    set -l out (command $program __complete $tokens "$current" 2>/dev/null)
    test (count $out) -gt 0; or return 0
    set -l directive $out[-1]
    set -e out[-1]
    test (count $out) -gt 0; and printf '%s\n' $out
    switch $directive
        case ':files:*'
            # files of that kind, and folders to go into them
            set -l kind (string replace ':files:' '' -- $directive)
            for f in (__fish_complete_path $current)
                set -l path (string split -f1 \t -- $f)
                if string match -q -- '*/' $path; or string match -q -- "*.$kind" $path
                    echo $f
                end
            end
        case ':default'
            test (count $out) -eq 0; and __fish_complete_path $current
    end
end
# -k: keep fullmark's order (a flag's values as declared, attempts newest first); fish would sort them
complete -c quiz -f -k -a '(__fullmark_complete)'
complete -c fullmark -f -k -a '(__fullmark_complete)'
