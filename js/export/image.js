export async function exportImage(map){
  const canvas = map.getCanvas();
  const dataURL = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = 'map.png';
  a.click();
}
