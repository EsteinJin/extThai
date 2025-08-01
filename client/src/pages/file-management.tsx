import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CloudUpload, Info, Download, ArrowLeft, FileText, CheckCircle, Search, Edit, Trash2, LogOut, Wand2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { validateJsonFile } from "@/lib/utils";
import { Link } from "wouter";
import { Card as CardType } from "@shared/schema";
import { downloadService, DownloadProgress } from "@/lib/download";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { LoginForm } from "@/components/login-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stableCacheManager } from "@/lib/stable-cache";
import { antiRefreshManager } from "@/lib/anti-refresh";

export default function FileManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCard, setEditingCard] = useState<CardType | null>(null);
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [uploadLevel, setUploadLevel] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  // Always call hooks first, before any conditional returns
  const { data: cards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards", selectedLevel, "management"],
    queryFn: () => fetch(`/api/cards?level=${selectedLevel}`).then(res => res.json()), // No random parameter for management
    enabled: isAuthenticated, // Only fetch when authenticated
    staleTime: Infinity, // 永不过期，只有手动刷新才更新
    gcTime: Infinity, // 永不垃圾回收
    refetchOnWindowFocus: false, // 窗口获得焦点时不刷新
    refetchOnMount: false, // 组件挂载时不重新获取
    refetchOnReconnect: false, // 网络重连时不刷新
    refetchInterval: false, // 禁用定期刷新
    notifyOnChangeProps: [], // 禁用所有状态变化通知，防止重新渲染
    networkMode: 'offlineFirst', // 离线优先，减少网络触发的刷新
  });

  // Store uploaded card IDs for later selection
  const [uploadedCardIds, setUploadedCardIds] = useState<Set<number>>(new Set());

  // Track cards count before upload to identify newly uploaded cards
  const [cardsCountBeforeUpload, setCardsCountBeforeUpload] = useState(0);

  // Auto-select only newly uploaded cards - 使用更稳定的依赖关系
  useEffect(() => {
    if (uploadSuccess && cardsCountBeforeUpload >= 0 && cards.length > cardsCountBeforeUpload) {
      // Only select cards that were added after the previous count
      const newlyUploadedCards = cards.slice(cardsCountBeforeUpload);
      const newCardIds = new Set(newlyUploadedCards.map(card => card.id));
      setUploadedCardIds(newCardIds);
      setSelectedCards(newCardIds);
      // Reset upload success flag after auto-selection
      setTimeout(() => setUploadSuccess(false), 1000);
      // Clear highlight after 10 seconds
      setTimeout(() => setUploadedCardIds(new Set()), 10000);
    }
  }, [uploadSuccess]); // 只依赖uploadSuccess，避免cards变化导致重新渲染



  // Check authentication on component mount
  useEffect(() => {
    const authStatus = localStorage.getItem("thai-app-auth");
    setIsAuthenticated(authStatus === "authenticated");
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("thai-app-auth");
    setIsAuthenticated(false);
    toast({
      title: "已退出登录",
      description: "您已成功退出文件管理系统",
    });
  };

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <LoginForm onLogin={setIsAuthenticated} />;
  }

  // Filter and sort cards - newly uploaded cards first, then by search term
  const filteredCards = cards
    .filter(card => 
      card.thai.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.chinese.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.pronunciation.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Sort newly uploaded cards to the top
      const aIsNew = uploadedCardIds.has(a.id);
      const bIsNew = uploadedCardIds.has(b.id);
      
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      return 0; // Keep original order for cards of the same type
    });

  const handleBatchDownload = async () => {
    const cardsToDownload = selectedCards.size > 0 
      ? cards.filter(card => selectedCards.has(card.id))
      : cards;

    if (cardsToDownload.length === 0) {
      toast({
        title: "没有可下载的卡片",
        description: selectedCards.size > 0 ? "请先选择要下载的卡片" : "请先上传JSON文件创建学习卡片",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsDownloading(true);
      await downloadService.downloadBatch(cardsToDownload, setDownloadProgress);
      
      toast({
        title: "下载完成",
        description: `已下载 ${cardsToDownload.length} 张卡片和语音文件`,
      });
      
      // Clear selection after successful download
      setSelectedCards(new Set());
    } catch (error) {
      console.error("Batch download failed:", error);
      toast({
        title: "下载失败",
        description: "请检查网络连接后重试",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleSelectCard = (cardId: number) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedCards.size === filteredCards.length) {
      setSelectedCards(new Set());
    } else {
      setSelectedCards(new Set(filteredCards.map(card => card.id)));
    }
  };

  const handleSelectUploaded = () => {
    // Select only the uploaded cards that are currently visible
    const uploadedAndVisible = cards.filter(card => uploadedCardIds.has(card.id));
    setSelectedCards(new Set(uploadedAndVisible.map(card => card.id)));
  };

  const handleDeleteCard = async (cardId: number) => {
    if (!confirm("确定要删除这张卡片吗？")) {
      return;
    }

    try {
      await apiRequest(`/api/cards/${cardId}`, "DELETE");

      // 移除自动刷新，避免页面重载
      // queryClient.invalidateQueries({ queryKey: ["/api/cards", selectedLevel] });
      // queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      
      // Remove from selected cards if it was selected
      const newSelected = new Set(selectedCards);
      newSelected.delete(cardId);
      setSelectedCards(newSelected);
      
      toast({
        title: "删除成功",
        description: "卡片已被删除，请手动刷新页面查看结果",
      });
    } catch (error) {
      toast({
        title: "删除失败",
        description: "请重试或检查网络连接",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = async (file: File) => {
    const isValid = await validateJsonFile(file);
    if (!isValid) {
      toast({
        title: "文件格式错误",
        description: "请选择正确格式的JSON文件",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setUploadSuccess(false);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "请先选择文件",
        description: "请选择一个JSON文件后再上传",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      
      // Store current cards count before upload
      setCardsCountBeforeUpload(cards.length);
      
      // Read file content and add level to each card
      const fileContent = await selectedFile.text();
      const jsonData = JSON.parse(fileContent);
      
      // Add level to each card
      if (jsonData.cards) {
        jsonData.cards = jsonData.cards.map((card: any) => ({
          ...card,
          level: uploadLevel
        }));
      }

      const formData = new FormData();
      const modifiedFile = new Blob([JSON.stringify(jsonData)], { type: 'application/json' });
      formData.append("file", modifiedFile, selectedFile.name);

      const response = await fetch("/api/cards/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      
      // 移除自动刷新，避免页面重载
      // await queryClient.invalidateQueries({ queryKey: ["/api/cards", selectedLevel] });
      // await queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      
      setUploadSuccess(true);
      setSelectedFile(null);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      toast({
        title: "上传成功",
        description: `已成功导入 ${result.count} 张学习卡片到基础泰语${uploadLevel}，请手动刷新页面查看新卡片`,
      });

      // Store uploaded card count for later reference
      const uploadedCount = result.count;
    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "上传失败",
        description: "请检查文件格式后重试",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };



  const handleDownloadSample = async () => {
    try {
      const response = await fetch("/api/cards/sample", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "thai_sample.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "下载完成",
        description: "样例文件已下载到本地",
      });
    } catch (error) {
      console.error("Download failed:", error);
      toast({
        title: "下载失败",
        description: "请重试或检查网络连接",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleInputClick = () => {
    fileInputRef.current?.click();
  };

  const handleClearAllCards = async () => {
    if (!confirm("确定要清空所有卡片吗？此操作无法撤销。")) {
      return;
    }

    try {
      await apiRequest("/api/cards/clear", "DELETE");

      // 移除自动刷新，避免页面重载
      // queryClient.invalidateQueries({ queryKey: ["/api/cards", selectedLevel] });
      // queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      setSelectedCards(new Set()); // Clear selection
      
      toast({
        title: "清空成功",
        description: "所有卡片已被清空",
      });
    } catch (error) {
      toast({
        title: "清空失败",
        description: "请重试或检查网络连接",
        variant: "destructive",
      });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedCards.size === 0) {
      toast({
        title: "请选择卡片",
        description: "请先选择要删除的卡片",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedCards.size} 张卡片吗？此操作无法撤销。`)) {
      return;
    }

    try {
      // Delete each selected card
      const deletePromises = Array.from(selectedCards).map(cardId => 
        apiRequest(`/api/cards/${cardId}`, "DELETE")
      );
      
      await Promise.all(deletePromises);

      // 移除自动刷新，避免页面重载
      // queryClient.invalidateQueries({ queryKey: ["/api/cards", selectedLevel] });
      // queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      setSelectedCards(new Set()); // Clear selection
      
      toast({
        title: "批量删除成功",
        description: `已成功删除 ${selectedCards.size} 张卡片，请手动刷新页面查看结果`,
      });
    } catch (error) {
      toast({
        title: "批量删除失败",
        description: "请重试或检查网络连接",
        variant: "destructive",
      });
    }
  };

;

  const handleGenerateFiles = async () => {
    if (selectedCards.size === 0) {
      toast({
        title: "请选择卡片",
        description: "请先选择要生成音频和图片的卡片",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`确定要为选中的 ${selectedCards.size} 张卡片生成音频和图片吗？`)) {
      return;
    }

    // 强制锁定页面，防止音频生成过程中页面刷新
    antiRefreshManager.lock();
    stableCacheManager.addRefreshBlocker("audio-generation");
    setIsGenerating(true);
    
    try {
      console.log("🎵 开始生成音频，页面已锁定防止刷新");
      
      const result = await apiRequest("/api/cards/generate", "POST", {
        cardIds: Array.from(selectedCards)
      }) as { success: boolean; results: any[] };

      const successful = result.results.filter(r => r.success).length;
      const failed = result.results.filter(r => !r.success).length;

      // 音频生成完成，绝对不自动刷新页面
      toast({
        title: "生成完成",
        description: `成功生成 ${successful} 张卡片的音频和图片${failed > 0 ? `，${failed} 张失败` : ''}`,
        action: (
          <Button
            size="sm"
            onClick={() => {
              // 完全重新加载页面
              window.location.reload();
            }}
          >
            手动刷新
          </Button>
        ),
      });

      // Clear selection after generation
      setSelectedCards(new Set());
      
    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: "生成失败",
        description: "请检查网络连接或稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      // 移除刷新阻塞器和页面锁定
      stableCacheManager.removeRefreshBlocker("audio-generation");
      antiRefreshManager.unlock();
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="text-center mb-12 relative">
        <div className="absolute top-0 right-0 flex items-center gap-2">
          <Button
            onClick={() => {
              // 手动刷新 - 完全重新加载页面而不是使用React Query
              window.location.reload();
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            手动刷新
          </Button>
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </Button>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">文件管理</h2>
        <p className="text-lg text-gray-600">上传JSON文件来管理您的泰语学习卡片</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="flex items-center mb-6">
              <CloudUpload className="text-2xl text-blue-500 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">上传JSON文件</h3>
            </div>
            
            {/* Level Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                上传到课程级别
              </label>
              <Select value={uploadLevel.toString()} onValueChange={(value) => setUploadLevel(parseInt(value))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择课程级别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">基础泰语1</SelectItem>
                  <SelectItem value="2">基础泰语2</SelectItem>
                  <SelectItem value="3">基础泰语3</SelectItem>
                  <SelectItem value="4">基础泰语4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Upload Zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 cursor-pointer transition-all ${
                isDragOver
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleInputClick}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".json"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <CloudUpload className="text-4xl text-gray-400 mb-4 mx-auto" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                点击或拖拽文件到此处
              </p>
              <p className="text-sm text-gray-500">支持 .json 格式文件</p>
              
              {selectedFile && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-center text-blue-700">
                    <FileText className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Upload Status */}
            {uploadSuccess && (
              <div className="mb-6 flex items-center justify-center space-x-2 text-emerald-600">
                <CheckCircle className="w-5 h-5" />
                <span>文件上传成功！</span>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleFileUpload}
                disabled={!selectedFile || isUploading}
                className="flex-1"
              >
                <CloudUpload className="w-4 h-4 mr-2" />
                {isUploading ? "上传中..." : "上传文件"}
              </Button>
              <Link href="/">
                <Button variant="outline" className="flex-1 w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回课程选择
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Sample & Help Section */}
        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="flex items-center mb-6">
              <Info className="text-2xl text-amber-500 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">帮助与示例</h3>
            </div>
            
            {/* Sample Download */}
            <div className="mb-8">
              <h4 className="text-lg font-medium text-gray-800 mb-3">JSON文件格式示例</h4>
              <p className="text-gray-600 mb-4">下载示例文件了解正确的JSON格式：</p>
              <Button
                onClick={handleDownloadSample}
                variant="outline"
                className="w-full border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
              >
                <Download className="w-4 h-4 mr-2" />
                下载样例文件
              </Button>
            </div>
            
            {/* JSON Format Guide */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">JSON格式说明：</h4>
              <div className="text-sm text-gray-600 space-y-2">
                <div>
                  <code className="bg-gray-200 px-2 py-1 rounded text-xs">thai</code>: 泰语单词
                </div>
                <div>
                  <code className="bg-gray-200 px-2 py-1 rounded text-xs">chinese</code>: 中文翻译
                </div>
                <div>
                  <code className="bg-gray-200 px-2 py-1 rounded text-xs">pronunciation</code>: 发音标注
                </div>
                <div>
                  <code className="bg-gray-200 px-2 py-1 rounded text-xs">example</code>: 泰语例句
                </div>
                <div>
                  <code className="bg-gray-200 px-2 py-1 rounded text-xs">example_translation</code>: 例句中文翻译
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Card Management Section */}
      <Card className="mt-8 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-semibold text-gray-900">卡片管理</h3>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">查看课程</label>
                  <Select value={selectedLevel.toString()} onValueChange={(value) => setSelectedLevel(parseInt(value))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">基础泰语1</SelectItem>
                      <SelectItem value="2">基础泰语2</SelectItem>
                      <SelectItem value="3">基础泰语3</SelectItem>
                      <SelectItem value="4">基础泰语4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {cards.length > 0 && (
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedCards.size === filteredCards.length && filteredCards.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                      <label htmlFor="select-all" className="text-sm text-gray-600 cursor-pointer">
                        全选 ({selectedCards.size}/{filteredCards.length})
                      </label>
                    </div>
                    {uploadedCardIds.size > 0 && (
                      <Button
                        onClick={handleSelectUploaded}
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                      >
                        选择新上传卡片 ({uploadedCardIds.size})
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleBatchDelete}
                disabled={selectedCards.size === 0}
                variant="outline"
                className="inline-flex items-center px-4 py-2 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                批量删除 ({selectedCards.size})
              </Button>
              <Button
                onClick={handleGenerateFiles}
                disabled={isGenerating || selectedCards.size === 0}
                variant="outline"
                className="inline-flex items-center px-4 py-2"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                {isGenerating 
                  ? "生成中..." 
                  : `生成音频图片 (${selectedCards.size})`}
              </Button>
              <Button
                onClick={handleBatchDownload}
                disabled={isDownloading || cards.length === 0}
                className="inline-flex items-center px-4 py-2"
              >
                <Download className="w-4 h-4 mr-2" />
                {isDownloading 
                  ? "下载中..." 
                  : selectedCards.size > 0 
                    ? `下载选中 (${selectedCards.size})` 
                    : "下载全部"}
              </Button>
            </div>
          </div>

          {cards.length > 0 ? (
            <>
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="搜索泰语单词、中文翻译或发音..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                基础泰语{selectedLevel} - 找到 {filteredCards.length} 张卡片，共 {cards.length} 张
              </p>
            </div>

            {/* Download Progress */}
            {downloadProgress && (
              <div className="mb-6 bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    {downloadProgress.status}
                  </span>
                  <span className="text-sm text-blue-700">
                    {downloadProgress.current} / {downloadProgress.total}
                  </span>
                </div>
                <Progress 
                  value={(downloadProgress.current / downloadProgress.total) * 100} 
                  className="h-2"
                />
              </div>
            )}

            {/* Cards List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredCards.map((card, index) => {
                  const isNewlyUploaded = uploadedCardIds.has(card.id);
                  return (
                  <div 
                    key={card.id} 
                    className={`flex items-center gap-3 p-4 rounded-lg transition-all duration-300 ${
                      isNewlyUploaded 
                        ? "bg-emerald-50 border-2 border-emerald-200 shadow-md" 
                        : "bg-gray-50 border border-transparent"
                    }`}
                  >
                    {isNewlyUploaded && (
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    )}
                    <Checkbox
                      id={`card-${card.id}`}
                      checked={selectedCards.has(card.id)}
                      onCheckedChange={() => handleSelectCard(card.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl" style={{fontFamily: 'system-ui, -apple-system, sans-serif'}}>{card.thai}</span>
                        <span className="text-gray-600">{card.chinese}</span>
                        <span className="text-sm text-gray-500">({card.pronunciation})</span>
                        {isNewlyUploaded && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                            新上传
                          </span>
                        )}
                      </div>
                      {card.example && (
                        <p className="text-sm text-gray-500 mt-1" style={{fontFamily: 'system-ui, -apple-system, sans-serif'}}>{card.example}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingCard(card)}
                        className="px-3 py-1"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCard(card.id)}
                        className="px-3 py-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  );
                })}
            </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              基础泰语{selectedLevel} 暂无卡片，请先上传JSON文件
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current File Info */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center">
            <FileText className="text-blue-500 text-xl mr-3" />
            <div>
              <h4 className="text-lg font-medium text-blue-900">当前文件状态</h4>
              <p className="text-blue-700">
                已加载 <span className="font-semibold">{cards.length}</span> 张卡片
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
