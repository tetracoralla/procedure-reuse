# 任务 B：docs-social

文档站要两枚 favicon 和三张社交卡片。可选 4:5 竖图可以没有。

第一次交货（`delivery/`）：`card-wide.jpg` 是 **176×100**，规格要 **176×99 / 16:9**。人眼看文件名齐全，但宽图高度不对。整批应 **fail**，`failedKits=["social"]`，`failedIds` 含 `height` 和 `aspect`。favicon 那一套应仍通过。

修复（`delivery-fixed/`）：只换成 176×99 的 JPEG。整批应 **pass**。本方法不负责把图生成出来。
