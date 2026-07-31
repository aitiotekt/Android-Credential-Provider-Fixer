param(
    [Parameter(Mandatory = $true)][string]$SourceDirectory,
    [Parameter(Mandatory = $true)][string]$Destination
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem
# Literal .NET paths preserve spaces and wildcard characters in checkout paths.
if ([System.IO.File]::Exists($Destination)) {
    [System.IO.File]::Delete($Destination)
}
[System.IO.Compression.ZipFile]::CreateFromDirectory($SourceDirectory, $Destination)
