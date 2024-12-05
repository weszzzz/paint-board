import { execSync } from 'child_process'

async function getFontList() {
  try {
    // 使用 PowerShell 命令获取系统字体的详细信息，包括中文名称
    const command = `
      Add-Type -AssemblyName System.Drawing
      [System.Drawing.Text.InstalledFontCollection]::new().Families | ForEach-Object {
        $family = $_
        $fontKey = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts")
        $fontName = $null
        $fontKey.GetValueNames() | ForEach-Object {
          if ($_.Contains($family.Name)) {
            $fontName = $_
          }
        }
        @{
          family = $family.Name
          fullName = $fontName -replace '\\s*\\([^\\)]*\\)\\s*$', '' # 移除括号中的文件扩展名
          localizedName = if ($fontName -match '[\\u4E00-\\u9FA5]') {
            $fontName -replace '\\s*\\([^\\)]*\\)\\s*$', ''
          } else { $null }
          style = $(
            if($family.Bold -and $family.Italic){'Bold Italic'}
            elseif($family.Bold){'Bold'}
            elseif($family.Italic){'Italic'}
            else{'Regular'}
          )
          weight = $(if($family.Bold){'700'}else{'400'})
          isItalic = $family.Italic
          isBold = $family.Bold
        } | ConvertTo-Json
      }
    `
    const output = execSync(`powershell -Command "${command}"`, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10 // 增加缓冲区大小
    })
    const fonts = output
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))

    // 按中文名称和英文名称分组输出
    console.log('\nSystem Fonts:')
    console.log('\nChinese Names:')
    const chineseFonts = fonts
      .filter((f) => f.localizedName)
      .sort((a, b) => a.localizedName.localeCompare(b.localizedName, 'zh-CN'))
    chineseFonts.forEach((font) => {
      console.log(
        `${font.localizedName} (${font.family})${
          font.style !== 'Regular' ? ` - ${font.style}` : ''
        }`
      )
    })

    console.log('\nEnglish Names:')
    const englishFonts = fonts
      .filter((f) => !f.localizedName)
      .sort((a, b) => a.family.localeCompare(b.family))
    englishFonts.forEach((font) => {
      console.log(
        `${font.family}${font.style !== 'Regular' ? ` - ${font.style}` : ''}`
      )
    })

    // 输出 JSON 格式的字体信息
    console.log('\nFont Information in JSON format:')
    const fontInfo = {
      chinese: chineseFonts.reduce((acc, font) => {
        if (!acc[font.localizedName]) {
          acc[font.localizedName] = {
            family: font.family,
            aliases: [font.localizedName, font.family],
            styles: []
          }
        }
        acc[font.localizedName].styles.push({
          name: font.style,
          weight: font.weight,
          style: font.isItalic ? 'italic' : 'normal'
        })
        return acc
      }, {}),
      english: englishFonts.reduce((acc, font) => {
        if (!acc[font.family]) {
          acc[font.family] = {
            family: font.family,
            styles: []
          }
        }
        acc[font.family].styles.push({
          name: font.style,
          weight: font.weight,
          style: font.isItalic ? 'italic' : 'normal'
        })
        return acc
      }, {})
    }
    console.log(JSON.stringify(fontInfo, null, 2))
  } catch (error) {
    console.error('Error getting font list:', error)
  }
}

getFontList().catch(console.error)