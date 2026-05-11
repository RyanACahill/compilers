; Generated LLVM IR
declare i32 @printf(i8*, ...)
@.intfmt = private constant [4 x i8] c"%d\0A\00"
@.strfmt = private constant [4 x i8] c"%s\0A\00"

define i32 @main() {
entry:
  %a_0 = alloca i32
  store i32 0, i32* %a_0
  store i32 3, i32* %a_0
  call i32 (i8*, ...) @printf(i8* getelementptr ([4 x i8], [4 x i8]* @.intfmt, i32 0, i32 0), i32 3)
  ret i32 0
}