# fullmark: Tab completion for `quiz` and `fullmark` in bash (Git Bash too). Add this line to ~/.bashrc:
#   eval "$(quiz shell-init bash)"
# Each Tab runs `quiz __complete WORDS...`: one candidate per line (value, a tab, a description), then a directive line.
# bash shows the values only. It needs no bash-completion package.
_fullmark_complete() {
    local cur=${COMP_WORDS[COMP_CWORD]} out line directive f
    COMPREPLY=()
    # a word with = in it is split by bash into three; the value is left to bash
    if [[ $cur == = || ${COMP_WORDS[COMP_CWORD-1]} == = ]]; then
        type compopt &>/dev/null && compopt -o default 2>/dev/null
        return 0
    fi
    out=$("${COMP_WORDS[0]}" __complete "${COMP_WORDS[@]:1:COMP_CWORD}" 2>/dev/null) || return 0
    [[ -n $out ]] || return 0
    while IFS= read -r line; do
        if [[ $line == :* ]]; then directive=$line; else COMPREPLY+=("${line%%$'\t'*}"); fi
    done <<<"$out"
    case $directive in
        :files:*)
            # files of that kind, and folders to go into them
            while IFS= read -r f; do
                [[ -d $f || $f == *."${directive#:files:}" ]] && COMPREPLY+=("$f")
            done < <(compgen -f -- "$cur")
            type compopt &>/dev/null && compopt -o filenames 2>/dev/null
            ;;
        :default)
            [[ ${#COMPREPLY[@]} -eq 0 ]] && type compopt &>/dev/null && compopt -o default 2>/dev/null
            ;;
    esac
    return 0
}
complete -F _fullmark_complete quiz fullmark
