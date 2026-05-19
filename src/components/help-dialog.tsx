import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface HelpDialogProps {
  open: boolean
  onClose: () => void
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="material-icons-outlined text-primary text-[22px]">help_outline</span>
            사용법 안내
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1 text-sm">

          <section>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-1.5">
              <span className="material-icons-outlined text-primary text-[18px]">search</span>
              1단계 — 성취기준 검색
            </h3>
            <ul className="space-y-1.5 text-muted-foreground pl-1">
              <li>• 교육과정 / 학년군 / 과목 / 영역 필터로 원하는 성취기준을 좁혀보세요.</li>
              <li>• 키워드 검색으로 내용이나 코드를 바로 찾을 수 있어요.</li>
              <li>• <span className="inline-flex items-center gap-0.5 text-foreground font-medium"><span className="material-icons-outlined text-[14px]">add_shopping_cart</span> 바구니 추가</span> 버튼으로 수업에 활용할 성취기준을 골라 담으세요.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-1.5">
              <span className="material-icons-outlined text-primary text-[18px]">edit_note</span>
              2단계 — 수업 디자인
            </h3>
            <ul className="space-y-1.5 text-muted-foreground pl-1">
              <li>• 바구니에 성취기준을 담은 뒤 <strong className="text-foreground">수업 디자인</strong> 탭으로 이동하세요.</li>
              <li>• 7단계 양식(수업자 의도 → 목표 → 과정 → 평가 → 자료 → 판서 → 메모)을 채워나가세요.</li>
              <li>• <span className="inline-flex items-center gap-0.5 text-foreground font-medium"><span className="material-icons-outlined text-[14px]">auto_awesome</span> AI 일괄 생성</span>을 누르면 목표·과정·평가를 자동으로 작성해줘요 (비밀번호 필요).</li>
              <li>• 각 섹션의 <span className="text-foreground font-medium">AI 재생성</span> 버튼으로 원하는 부분만 다시 생성할 수 있어요.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-1.5">
              <span className="material-icons-outlined text-primary text-[18px]">save</span>
              저장 · 내보내기
            </h3>
            <ul className="space-y-1.5 text-muted-foreground pl-1">
              <li>• <strong className="text-foreground">JSON 저장</strong>: 작업 내용을 저장하고 나중에 불러올 수 있어요.</li>
              <li>• <strong className="text-foreground">MD 저장</strong>: 마크다운 파일로 다운로드해 문서로 활용하세요.</li>
              <li>• <strong className="text-foreground">링크 공유</strong>: 작성한 수업 디자인을 URL로 공유할 수 있어요.</li>
            </ul>
          </section>

          <hr className="border-border/60" />

          <section className="space-y-1.5 text-muted-foreground">
            <p className="flex items-center gap-2">
              <span className="material-icons-outlined text-[16px]">person</span>
              <span><strong className="text-foreground">개발자</strong>: 교육뮤지컬 꿈꾸는 치수쌤</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="material-icons-outlined text-[16px]">link</span>
              <span><strong className="text-foreground">문의</strong>:{" "}
                <a href="https://litt.ly/chichiboo" target="_blank" rel="noopener noreferrer"
                   className="text-primary hover:underline">litt.ly/chichiboo</a>
              </span>
            </p>
            <p className="flex items-center gap-2 leading-snug">
              <span className="material-icons-outlined text-[16px] shrink-0">menu_book</span>
              <span><strong className="text-foreground">데이터 출처</strong>: 2022 개정 교육과정 (교육부 고시 제2022-33호)</span>
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
