import os
import subprocess
import sys
import webbrowser
import time
import locale

def print_color(text, color='white'):
    colors = {
        'red': '\033[91m',
        'green': '\033[92m',
        'yellow': '\033[93m',
        'blue': '\033[94m',
        'white': '\033[97m',
        'end': '\033[0m'
    }
    print(f"{colors.get(color, colors['white'])}{text}{colors['end']}")

def check_environment():
    # 检查package.json
    if not os.path.exists('package.json'):
        print_color('错误：当前目录下未找到package.json文件', 'red')
        print_color('请确保将启动脚本放在项目根目录下运行', 'yellow')
        return False
    
    # 检查Node.js
    try:
        node_version = subprocess.run('node -v', shell=True, capture_output=True, encoding='utf-8')
        if node_version.returncode == 0:
            print_color(f'✓ Node.js {node_version.stdout.strip()}', 'green')
        else:
            raise FileNotFoundError
    except FileNotFoundError:
        print_color('✗ 未检测到Node.js', 'red')
        print_color('请访问 https://nodejs.org/ 下载安装LTS版本', 'yellow')
        return False
    
    # 检查pnpm
    try:
        pnpm_version = subprocess.run('pnpm -v', shell=True, capture_output=True, encoding='utf-8')
        if pnpm_version.returncode == 0:
            print_color(f'✓ pnpm {pnpm_version.stdout.strip()}', 'green')
        else:
            raise FileNotFoundError
    except:
        print_color('✗ 未检测到pnpm', 'red')
        print_color('请运行 npm install -g pnpm 安装', 'yellow')
        return False
    
    return True

def main():
    # 设置控制台编码
    if sys.platform.startswith('win'):
        os.system('chcp 65001')
    os.system('color')  # 启用彩色输出
    
    print_color('正在检查环境...', 'blue')
    
    if not check_environment():
        return
    
    print_color('\n正在启动项目...', 'green')
    print_color('项目启动后将自动打开浏览器', 'blue')
    print_color('您也可以手动访问: http://localhost:5173/paint-board/', 'blue')
    print_color('按 Ctrl+C 可停止项目运行\n', 'yellow')
    
    try:
        # 创建新的环境变量副本，设置编码
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        
        # 使用shell=True来运行命令，并设置编码
        process = subprocess.Popen(
            'pnpm dev',
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding='utf-8',
            env=env,
            errors='replace'  # 使用replace处理无法解码的字符
        )
        
        # 等待服务启动
        time.sleep(2)
        webbrowser.open('http://localhost:5173/paint-board/')
        
        # 实时输出日志
        while True:
            try:
                output = process.stdout.readline()
                if output:
                    # 过滤掉base警告
                    if '"base" option' not in output:
                        print(output.strip())
                if process.poll() is not None:
                    break
            except UnicodeDecodeError:
                continue  # 忽略解码错误，继续处理下一行
            
    except KeyboardInterrupt:
        print_color('\n项目已停止运行', 'yellow')
    finally:
        if process.poll() is None:
            process.terminate()

if __name__ == '__main__':
    main() 