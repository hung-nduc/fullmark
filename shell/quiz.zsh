# fullmark: Tab completion for `quiz` and `fullmark` in zsh. Add this line to ~/.zshrc, after compinit:
#   eval "$(quiz shell-init zsh)"
# Each Tab runs `quiz __complete WORDS...`: one candidate per line (value, a tab, a description), then a directive line.
_fullmark_complete() {
    local -a lines items
    local directive line
    lines=("${(@f)$("${words[1]}" __complete "${(@)words[2,CURRENT]}" 2>/dev/null)}")
    directive=${lines[-1]}
    lines=("${(@)lines[1,-2]}")
    for line in "${(@)lines}"; do
        items+=("${line/$'\t'/:}")
    done
    (( ${#items} )) && _describe -t values 'fullmark' items
    case $directive in
        :files:*) _files -g "*.${directive#:files:}" ;;
        :default) (( ${#items} )) || _files ;;
    esac
    return 0
}
compdef _fullmark_complete quiz fullmark
