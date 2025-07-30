import JSZip from "jszip";
import { audioService } from "./audio";
import { Card } from "@shared/schema";
import html2canvas from "html2canvas";

export interface DownloadProgress {
  current: number;
  total: number;
  status: string;
}

export class DownloadService {
  private static instance: DownloadService;

  static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  async downloadBatch(
    cards: Card[],
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    const zip = new JSZip();
    const imageFolder = zip.folder("images");
    const audioFolder = zip.folder("audio");

    if (!imageFolder || !audioFolder) {
      throw new Error("Failed to create ZIP folders");
    }

    const totalItems = cards.length * 2; // 1 image + 1 example audio per card
    let completedItems = 0;

    const updateProgress = (status: string) => {
      if (onProgress) {
        onProgress({
          current: completedItems,
          total: totalItems,
          status
        });
      }
    };

    try {
      for (let index = 0; index < cards.length; index++) {
        const card = cards[index];
        // Generate card image
        updateProgress(`生成卡片 ${index + 1} 图片...`);
        const imageBlob = await this.generateCardImage(card, index);
        imageFolder.file(`card_${index + 1}_${card.thai}.png`, imageBlob);
        completedItems++;
        updateProgress(`完成卡片 ${index + 1} 图片`);

        // Generate example audio only (skip word audio)
        updateProgress(`生成卡片 ${index + 1} 例句语音...`);
        try {
          const exampleAudioUrl = await audioService.generateAudio(card.example, "th-TH");
          if (exampleAudioUrl) {
            const audioResponse = await fetch(exampleAudioUrl, {
              credentials: 'include'
            });
            if (audioResponse.ok) {
              const audioBlob = await audioResponse.blob();
              audioFolder.file(`card_${index + 1}_example_${card.thai}.mp3`, audioBlob);
            }
          }
        } catch (error) {
          console.error(`Failed to generate example audio for card ${index + 1}:`, error);
        }
        completedItems++;
      }

      updateProgress("正在打包文件...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      
      // Download the ZIP file
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `thai_cards_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      updateProgress("下载完成！");
    } catch (error) {
      console.error("Batch download failed:", error);
      throw error;
    }
  }

  private async generateCardImage(card: Card, index: number): Promise<Blob> {
    // Create a temporary div to render the card
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.width = "600px";
    tempDiv.style.padding = "32px";
    tempDiv.style.backgroundColor = "white";
    tempDiv.style.borderRadius = "16px";
    tempDiv.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.1)";
    tempDiv.style.fontFamily = "system-ui, -apple-system, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif";

    tempDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <span style="display: inline-flex; align-items: center; padding: 8px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; background-color: #dbeafe; color: #1e40af;">
          卡片 #${index + 1}
        </span>
      </div>
      
      <div style="margin-bottom: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; font-weight: bold; color: #111827; margin-bottom: 8px;">${card.thai}</div>
          <div style="font-size: 18px; color: #6b7280; font-style: italic;">${card.pronunciation}</div>
        </div>
        
        <div style="border-top: 1px solid #e5e7eb; margin: 24px 0;"></div>
        
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 24px; font-weight: 600; color: #1f2937;">${card.chinese}</div>
        </div>
        
        <div style="background-color: #fef3c7; border-radius: 12px; padding: 24px;">
          <h4 style="font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 18px;">例句</h4>
          <div style="margin-bottom: 15px;">
            <p style="font-size: 32px; color: #92400e; margin: 0; line-height: 1.4; font-weight: 700;">${card.example}</p>
          </div>
          <div>
            <p style="font-size: 24px; color: #78716c; margin: 0; line-height: 1.3; font-weight: 600;">${card.example_translation}</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(tempDiv);

    try {
      const canvas = await html2canvas(tempDiv, {
        backgroundColor: "white",
        scale: 2,
        useCORS: true
      });

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob!);
        }, "image/png");
      });
    } finally {
      document.body.removeChild(tempDiv);
    }
  }
}

export const downloadService = DownloadService.getInstance();
