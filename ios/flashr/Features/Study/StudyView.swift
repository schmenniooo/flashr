import SwiftUI

struct StudyView: View {
    var body: some View {
        ZStack {
            Color.flashrBg.ignoresSafeArea()
            Text("Study")
                .font(.flashrH1)
                .foregroundStyle(Color.flashrText)
        }
        .navigationTitle("Study")
    }
}
