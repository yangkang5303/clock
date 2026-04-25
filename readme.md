# 艺术画家闹钟 (Character Painter Clock) 🎨⏰

**Artistic Character Painter Clock** is a creative and artistic digital clock that replaces traditional hands with a charming artist character who manually paints and erases the time. Instead of static pointers, you witness a delightful 2D artist at work behind the clock face. As time progresses, the artist uses a sponge to wipe away the old time and a brush to paint the new time with vibrant strokes.

**艺术画家闹钟** 是一款创意十足的数字艺术时钟。它摒弃了传统的指针设计，由一个可爱的 2D 艺术家角色在表盘后方手动绘制和擦除时间。随着时间的推移，这位艺术家会先用海绵擦掉旧的时间，然后用画笔画出新的时间，为您带来如丝般顺滑的视觉体验。

## Features (功能特点)
- **Character Animation (角色动画)**: A charming 2D artist character acts as the clock hands.
- **Hand-Drawn Style (手绘风格)**: All clock hands are hand-painted with textured brush strokes.
- **Sponge Eraser (海绵擦除)**: The artist uses a sponge to erase the previous time markings.
- **Paint Brush (画笔绘制)**: The artist paints the new time with artistic flair.
- **Smooth Transitions (平滑过渡)**: Seamless animation between time updates.
- **Clean UI (简洁界面)**: Minimalist glassmorphism design with a modern backdrop.
- **Responsive Design (响应式设计)**: Adapts to different screen sizes automatically.
- **Audio Feedback (可选音频)**: Subtle sounds for painting and erasing (disabled by default for silence).

## Installation (安装指南)

### Method 1: GitHub Pages (推荐)

**The simplest way is to use GitHub Pages for instant access!**

1. Click the "Use this template" button on GitHub to create your own repository.
2. Or simply click here to view the live demo:
   **[Live Demo on GitHub Pages](https://yourusername.github.io/character-painter-clock)**
   *(Replace `yourusername` with your actual GitHub username after creating the repo)*

**最简单的方法是使用 GitHub Pages 部署！**

1. 点击 GitHub 上的 "Use this template" 按钮创建您自己的仓库。
2. 或者直接点击这里查看实时演示：
   **[GitHub Pages 实时演示](https://yourusername.github.io/character-painter-clock)**
   *(创建仓库后，将 `yourusername` 替换为您自己的 GitHub 用户名)*

### Method 2: Local Installation

If you prefer to run it on your own computer:

**如何本地运行：**

1. **Clone the repository** (克隆仓库)
   ```bash
   git clone https://github.com/yourusername/character-painter-clock.git
   cd character-painter-clock
   ```

2. **Open in browser** (在浏览器中打开)
   - Just double-click the `index.html` file.
   - Or open it with your browser's "Open File" feature.
   - **Tip**: For some browsers (like Chrome), you might need to run a local web server for the best experience. You can use the built-in server in VS Code or install Python's `http.server`:
     ```bash
     # Run this in the project folder if needed
     python -m http.server 8000
     # Then open http://localhost:8000 in your browser
     ```

   - 只需要双击 `index.html` 文件。
   - 或者使用浏览器的“打开文件”功能。
   - **提示**：对于某些浏览器（如 Chrome），为了获得最佳体验，您可能需要运行本地 Web 服务器。您可以使用 VS Code 的内置服务器，或安装 Python 的 `http.server`：
     ```bash
     # 需要时在项目文件夹中运行
     python -m http.server 8000
     # 然后在浏览器中打开 http://localhost:8000
     ```

## Usage (使用方法)

1. Open `index.html` in your web browser.
   打开 `index.html` 文件。

2. The artist character will appear on the clock face, ready to draw the current time.
   艺术家角色会出现在表盘上，准备绘制当前时间。

3. Watch as the artist draws the hands with textured strokes and erases the old time with a sponge.
   观看艺术家如何用有纹理的笔触画出手，并用海绵擦除旧时间。

4. The clock updates automatically every second for the minute hand, and every minute for the hour hand.
   分针每秒更新一次，时针每分钟更新一次。

## Configuration (配置选项)

You can easily customize the clock by editing the `app.js` file.
您可以编辑 `app.js` 文件轻松自定义时钟。

### Available Configurations

Open `app.js` and look for the `CONFIG` object. You can modify:
- **`eraseDuration`**: Time taken to erase (in milliseconds).
- **`paintDuration`**: Time taken to paint (in milliseconds).
- **`prepareDuration`**: Time to move to position before starting.
- **`handColors`**: Custom colors for hour, minute, and second hands.
- **`characterColor`**: Main color for the artist character.

编辑 `app.js` 文件，找到 `CONFIG` 对象。您可以修改：
- **`eraseDuration`**: 擦除所需时间（毫秒）。
- **`paintDuration`**: 绘制所需时间（毫秒）。
- **`prepareDuration`**: 开始前移动到位置所需时间。
- **`handColors`**: 时针、分针和秒针的自定义颜色。
- **`characterColor`**: 艺术家角色的主色调。

### Enable Audio Feedback

If you want to hear the sounds of the clock:

1. In `app.js`, find `const audioCtx = new (window.AudioContext || window.webkitAudioContext)();`
2. Uncomment the sound generation code (remove `//` at the beginning of the lines).

**如何启用音频反馈：**

1. 在 `app.js` 中，找到 `const audioCtx = new (window.AudioContext || window.webkitAudioContext)();`
2. 取消注释声音生成代码（删除行开头的 `//`）。

## Technical Details

The clock uses:
- **HTML5 Canvas** for all drawing operations
- **JavaScript** for logic and animation
- **CSS Glassmorphism** for a modern, frosted glass effect
- **Hand-drawn paths** that mimic real brush strokes

该时钟使用：
- **HTML5 Canvas** 进行所有绘图操作
- **JavaScript** 处理逻辑和动画
- **CSS Glassmorphism** 实现现代磨砂玻璃效果
- **手绘路径** 模拟真实的笔触