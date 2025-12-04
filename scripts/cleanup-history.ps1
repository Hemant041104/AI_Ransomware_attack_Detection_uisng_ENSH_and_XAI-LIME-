<#
cleanup-history.ps1

Safe helper to:
 - create a local backup of the repo folder
 - ensure git-filter-repo is installed
 - remove any git blobs bigger than 100MB from history
 - run git GC
 - optionally force-push cleaned history to origin

USAGE (PowerShell):
  cd to the repository root and run:
    .\scripts\cleanup-history.ps1

IMPORTANT: This script rewrites history. Make sure you have a backup and coordinate with collaborators.
#>

param()

function Abort($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

$repoRoot = (Get-Location).Path
Write-Host "Repository root: $repoRoot"

# 1) Backup
$backupRoot = "${env:SystemDrive}\MultipleFiles_backup"
Write-Host "Creating backup to: $backupRoot"
if (-not (Test-Path $backupRoot)) { New-Item -ItemType Directory -Path $backupRoot | Out-Null }

Write-Host "Running robocopy (this may take a while)..."
$robocopyArgs = @(
    "$repoRoot",
    $backupRoot,
    '/MIR',
    '/NDL', '/NFL'
)
& robocopy @robocopyArgs | Out-Null
Write-Host "Backup finished. Verify $backupRoot contains your repo copy."

# 2) Verify git status is clean
Write-Host "Checking git status..."
$status = git status --porcelain
if ($status) {
    Write-Host "You have uncommitted changes. Commit or stash them before proceeding." -ForegroundColor Yellow
    git status
    Exit 1
}

# 3) Check for git-filter-repo
Write-Host "Checking for git-filter-repo..."
try {
    git filter-repo --version 2>$null | Out-Null
} catch {
    Write-Host "git-filter-repo not found. Attempting to install via pip..." -ForegroundColor Yellow
    try {
        pip install --user git-filter-repo
        Write-Host "Installed git-filter-repo via pip."
    } catch {
        Abort "Please install git-filter-repo manually: https://github.com/newren/git-filter-repo#install"
    }
}

Write-Host "About to remove any blobs larger than 100MB from the repository history. This rewrites history and requires a force-push to update origin." -ForegroundColor Yellow
$confirm = Read-Host "Proceed? Type YES to continue"
if ($confirm -ne 'YES') { Write-Host "Aborted by user."; exit 0 }

# 4) Run git-filter-repo
Write-Host "Running: git filter-repo --strip-blobs-bigger-than 100M"
git filter-repo --strip-blobs-bigger-than 100M

# 5) Cleanup
Write-Host "Expiring reflog and running garbage collection..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 6) Untrack problematic folders (ensure they won't be re-added)
Write-Host "Removing tracked paths backend/uploads and backend/archive from index (if present)..."
git rm -r --cached backend/uploads backend/archive -f 2>$null | Out-Null
git add .gitignore 2>$null | Out-Null
try { git commit -m "Remove uploads/archive from repo and add .gitignore" } catch { Write-Host "No commit necessary." }

# 7) Prompt before force-push
Write-Host "Local history cleaned. Next step: force-push rewritten history to origin. This will replace remote history." -ForegroundColor Yellow
$doPush = Read-Host "Force-push to origin now? Type PUSH to proceed"
if ($doPush -eq 'PUSH') {
    Write-Host "Force pushing all branches and tags to origin..."
    git push origin --force --all
    git push origin --force --tags
    Write-Host "Force-push completed. Verify your GitHub repository." -ForegroundColor Green
} else {
    Write-Host "Skipping push. When ready run: git push origin --force --all  and git push origin --force --tags" -ForegroundColor Cyan
}

Write-Host "Done." -ForegroundColor Green
