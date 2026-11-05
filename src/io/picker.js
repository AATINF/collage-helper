/** 从系统相册选图（浏览器和 App 里都是同一个 <input type=file>，Capacitor 会自动接管） */

export function pickImages({ multiple = true } = {}) {
  const input = document.getElementById('fileInput');
  if (!input) throw new Error('缺少 fileInput');
  input.value = '';
  input.multiple = multiple;
  return new Promise(resolve => {
    const onChange = () => {
      input.removeEventListener('change', onChange);
      resolve(Array.from(input.files || []));
    };
    input.addEventListener('change', onChange);
    input.click();
  });
}

/** 过滤掉非图片（少数机型会给出奇怪的文件类型） */
export function onlyImages(files) {
  return files.filter(f => !f.type || f.type.startsWith('image/'));
}
