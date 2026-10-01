
# find . -type f -name "*.ts" -print0 | xargs -0 perl -0pi -e 's{/\*[\s\S]*?\*/}{}g; s{//[^\r\n]*}{}g'

# find . -type f -name "*test.ts" -delete